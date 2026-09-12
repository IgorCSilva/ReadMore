#!/usr/bin/env python3
"""Static file server + per-user learning data + GET /tts endpoint.

Run from this directory (or anywhere, it locates itself):
    python3 server.py [port]   # default port 8000

Then open http://127.0.0.1:8000/viewer.html

Data model
----------
catalog.json   shared content, keyed by language. Each language has:
                 "words": [{word_id, original, filename, sentence, cue}, ...]
                 "chapters": [{chapter_id, number, title, description, status,
                   topics: [
                   {topic_id, number, title, description, status, word_ids: [
                    ...new words this topic introduces...], texts: [{text_id,
                    number, title, body}, ...]}
                 ]}]
               "status" is "ready" or "in_development" (missing = "ready");
               in_development chapters/topics still travel to the client but
               render disabled there — filtering never happens server-side.
               Same for every user, read-only, baked into the image/repo.
               A text's "body" uses **word** for bold spans.
Google Sheet   per-user data, reached through a Google Apps Script "Web App"
               front end (see apps-script/Code.gs) over plain HTTP, so it
               survives regardless of the host's filesystem being ephemeral:
                 "progress" tab: one row per (email, lang, word_id) holding
                   confident/shown_count/show. A user only has rows for words
                   assigned to them; a brand-new user simply has no rows.
                 "topics" tab: one row per (email, lang, topic_id). A row's
                   presence means that topic (and its texts) is visible to
                   that user; a topic with no row is hidden.
               Configured via the SHEETS_WEBAPP_URL / SHEETS_API_TOKEN env
               vars (see .env.example).

Endpoints
---------
GET  /languages                        -> list of languages in the catalog
GET  /data?user=<email>&lang=<lang>    -> merged catalog+progress for that user/lang
GET  /chapters?user=<email>&lang=<lang> -> chapters/topics/texts visible to that user
POST /increment    {user, lang, word_id}
POST /mark-known   {user, lang, word_id}
POST /show-word    {user, lang, word_id}
GET  /tts?text=...                     -> proxies Google Translate TTS

/tts proxies Google Translate's TTS endpoint server-side so the browser only
ever talks to same-origin http://127.0.0.1:PORT, avoiding CORS/ORB blocking
that direct cross-origin requests to translate.google.com run into.
"""
import http.server
import json
import os
import posixpath
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
CATALOG_PATH = os.path.join(DIR, "catalog.json")
LOCK = threading.Lock()

EMAIL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")
SHEETS_TIMEOUT = 25


class SheetsError(Exception):
    pass


def load_catalog():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _sheets_request(method, params=None, body=None):
    if not SHEETS_WEBAPP_URL or not SHEETS_API_TOKEN:
        raise SheetsError(
            "SHEETS_WEBAPP_URL and SHEETS_API_TOKEN must be set (see .env.example)"
        )

    # Google's infrastructure appears to block/throttle the default
    # "Python-urllib/x.y" User-Agent for this redirect chain (exec -> content),
    # causing intermittent timeouts/404s. A browser-like UA avoids that
    # entirely — same reason handle_tts sets one for the Google Translate call.
    common_headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        ),
    }

    if method == "GET":
        query = urllib.parse.urlencode({**(params or {}), "token": SHEETS_API_TOKEN})
        req = urllib.request.Request(f"{SHEETS_WEBAPP_URL}?{query}", method="GET", headers=common_headers)
    else:
        payload = {**(body or {}), "token": SHEETS_API_TOKEN}
        req = urllib.request.Request(
            SHEETS_WEBAPP_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={**common_headers, "Content-Type": "application/json"},
            method="POST",
        )

    # The exec -> googleusercontent.com redirect Google uses to serve the
    # actual response occasionally drops a hop with a transport-level
    # error (404/timeout) even though the script itself is healthy. These
    # are transient, so a couple of quick retries clear them up.
    attempts = 3
    last_err = None
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=SHEETS_TIMEOUT) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            break
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as err:
            # A read timeout that happens after the connection is already open
            # surfaces as a bare TimeoutError, not wrapped in URLError — must
            # be caught explicitly or it skips the retry loop entirely.
            last_err = err
            if attempt < attempts - 1:
                time.sleep(1)
        except json.JSONDecodeError as err:
            raise SheetsError(f"spreadsheet returned invalid JSON: {err}") from err
    else:
        raise SheetsError(f"spreadsheet request failed after {attempts} attempts: {last_err}") from last_err

    # Apps Script Web Apps always answer HTTP 200 at the transport level, so
    # logical success/failure travels inside the JSON body's "status" field.
    if data.get("status", 200) >= 400:
        raise SheetsError(data.get("error", "unknown spreadsheet error"))
    return data


def load_user_lang(email, lang):
    """Words assigned to this user for this language: {word_id: {confident, shown_count, show}}."""
    data = _sheets_request("GET", params={"action": "get", "email": email, "lang": lang})
    return data.get("words", {})


def upsert_progress(email, lang, word_id, confident, shown_count, show):
    """Update the single (email, lang, word_id) row. Raises SheetsError if that word isn't assigned."""
    _sheets_request("POST", body={
        "action": "upsert",
        "email": email,
        "lang": lang,
        "word_id": word_id,
        "confident": confident,
        "shown_count": shown_count,
        "show": show,
    })


def load_enabled_topics(email, lang):
    """Set of topic_ids visible to this user for this language."""
    data = _sheets_request("GET", params={"action": "get_topics", "email": email, "lang": lang})
    return set(data.get("topic_ids", []))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def log_message(self, fmt, *args):
        if self.path.startswith(("/increment", "/mark-known", "/show-word", "/data", "/chapters", "/languages", "/tts")):
            super().log_message(fmt, *args)
        # keep static GET logs quiet

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/tts":
            self.handle_tts(parsed)
            return
        if parsed.path == "/languages":
            self.handle_languages()
            return
        if parsed.path == "/data":
            self.handle_data(parsed)
            return
        if parsed.path == "/chapters":
            self.handle_chapters(parsed)
            return

        # Only /viewer.html and images/ are servable as static files; everything
        # else (catalog.json, server.py, .git, ...) stays off-limits.
        # Normalize first so tricks like /images/../catalog.json can't sneak past
        # the prefix check (SimpleHTTPRequestHandler normalizes ".." internally too).
        normalized = posixpath.normpath(urllib.parse.unquote(parsed.path))
        if normalized in ("/", ""):
            self.send_response(302)
            self.send_header("Location", "/viewer.html")
            self.end_headers()
            return
        if normalized == "/viewer.html" or normalized.startswith("/images/"):
            super().do_GET()
            return
        self._send_json(404, {"error": "not found"})

    def do_HEAD(self):
        # SimpleHTTPRequestHandler.do_HEAD serves files directly and isn't routed
        # through do_GET, so it needs the same allowlist or it bypasses it entirely.
        parsed = urllib.parse.urlparse(self.path)
        normalized = posixpath.normpath(urllib.parse.unquote(parsed.path))
        if normalized == "/viewer.html" or normalized.startswith("/images/"):
            super().do_HEAD()
            return
        self.send_response(404)
        self.end_headers()

    def handle_languages(self):
        try:
            catalog = load_catalog()
        except (OSError, json.JSONDecodeError) as err:
            self._send_json(500, {"error": f"couldn't read catalog: {err}"})
            return
        self._send_json(200, {"languages": list(catalog.keys())})

    def handle_data(self, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        email = (query.get("user", [""])[0]).strip()
        lang = (query.get("lang", [""])[0]).strip() or "english"

        if not EMAIL_RE.fullmatch(email):
            self._send_json(400, {"error": "missing or invalid 'user' query param"})
            return

        try:
            catalog = load_catalog()
        except (OSError, json.JSONDecodeError) as err:
            self._send_json(500, {"error": f"couldn't read catalog: {err}"})
            return

        if lang not in catalog:
            self._send_json(404, {"error": f"unknown language: {lang}"})
            return

        try:
            progress = load_user_lang(email, lang)
        except SheetsError as err:
            self._send_json(502, {"error": str(err)})
            return

        words = []
        for entry in catalog[lang]["words"]:
            word_id = entry["word_id"]
            if word_id not in progress:
                continue
            p = progress[word_id]
            words.append({**entry, **p})

        self._send_json(200, {"lang": lang, "words": words})

    def handle_chapters(self, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        email = (query.get("user", [""])[0]).strip()
        lang = (query.get("lang", [""])[0]).strip() or "english"

        if not EMAIL_RE.fullmatch(email):
            self._send_json(400, {"error": "missing or invalid 'user' query param"})
            return

        try:
            catalog = load_catalog()
        except (OSError, json.JSONDecodeError) as err:
            self._send_json(500, {"error": f"couldn't read catalog: {err}"})
            return

        if lang not in catalog:
            self._send_json(404, {"error": f"unknown language: {lang}"})
            return

        try:
            enabled_topic_ids = load_enabled_topics(email, lang)
        except SheetsError as err:
            self._send_json(502, {"error": str(err)})
            return

        chapters = []
        for chapter in catalog[lang].get("chapters", []):
            visible_topics = [t for t in chapter.get("topics", []) if t["topic_id"] in enabled_topic_ids]
            if not visible_topics:
                continue
            chapters.append({**chapter, "topics": visible_topics})

        self._send_json(200, {"lang": lang, "chapters": chapters})

    def handle_tts(self, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        text = (query.get("text", [""])[0]).strip()
        if not text:
            self._send_json(400, {"error": "missing 'text' query param"})
            return

        google_url = (
            "https://translate.google.com/translate_tts?ie=UTF-8&q="
            + urllib.parse.quote(text)
            + "&tl=en&client=tw-ob"
        )
        req = urllib.request.Request(
            google_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
                ),
                "Referer": "https://translate.google.com/",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                audio_bytes = resp.read()
                content_type = resp.headers.get("Content-Type", "audio/mpeg")
        except (urllib.error.URLError, urllib.error.HTTPError) as err:
            self._send_json(502, {"error": f"TTS upstream failed: {err}"})
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(audio_bytes)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(audio_bytes)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path not in ("/increment", "/mark-known", "/show-word"):
            self._send_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            self._send_json(400, {"error": "invalid json"})
            return

        email = (payload.get("user") or "").strip()
        lang = (payload.get("lang") or "").strip() or "english"
        word_id = payload.get("word_id")

        if not EMAIL_RE.fullmatch(email):
            self._send_json(400, {"error": "missing or invalid 'user'"})
            return
        if not word_id:
            self._send_json(400, {"error": "missing 'word_id'"})
            return

        with LOCK:
            try:
                progress = load_user_lang(email, lang)
            except SheetsError as err:
                self._send_json(502, {"error": str(err)})
                return

            entry = progress.get(word_id)
            if entry is None:
                self._send_json(404, {"error": f"word not assigned to user: {word_id}"})
                return

            confident = entry.get("confident", False)
            shown_count = entry.get("shown_count", 0)
            show = entry.get("show", True)

            if self.path == "/increment":
                shown_count += 1
            elif self.path == "/mark-known":
                show = False
            else:  # /show-word
                show = True

            try:
                upsert_progress(email, lang, word_id, confident, shown_count, show)
            except SheetsError as err:
                self._send_json(502, {"error": str(err)})
                return

            if self.path == "/increment":
                self._send_json(200, {"word_id": word_id, "shown_count": shown_count})
            elif self.path == "/mark-known":
                self._send_json(200, {"word_id": word_id, "show": False})
            else:
                self._send_json(200, {"word_id": word_id, "show": True})


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", sys.argv[1] if len(sys.argv) > 1 else "8000"))
    if not SHEETS_WEBAPP_URL or not SHEETS_API_TOKEN:
        print("WARNING: SHEETS_WEBAPP_URL / SHEETS_API_TOKEN not set — /data and progress "
              "endpoints will fail until they're configured (see .env.example).")
    server = http.server.ThreadingHTTPServer((host, port), Handler)
    print(f"Serving {DIR} at http://{host}:{port}")
    server.serve_forever()
