"""GoogleSheetsProgressRepository — reads/writes per-user progress through the
Google Apps Script "Web App" front end (see backend/apps-script/Code.gs).

Same HTTP contract as backend/server.py's _sheets_request/load_user_lang/
upsert_progress, lifted here unchanged (retry loop, User-Agent workaround,
status-in-body error convention) so behavior stays identical.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.domain.entities import ProgressRecord
from backend.app.domain.value_objects import Email

# Google's infrastructure appears to block/throttle the default
# "Python-urllib/x.y" User-Agent for this redirect chain (exec -> content),
# causing intermittent timeouts/404s. A browser-like UA avoids that entirely.
_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


class SheetsError(Exception):
    pass


class GoogleSheetsProgressRepository(ProgressRepository):
    def __init__(self, webapp_url: str, api_token: str, timeout: int = 25) -> None:
        self._webapp_url = webapp_url
        self._api_token = api_token
        self._timeout = timeout

    def _request(
        self, method: str, params: dict | None = None, body: dict | None = None
    ) -> dict:
        if not self._webapp_url or not self._api_token:
            raise SheetsError(
                "SHEETS_WEBAPP_URL and SHEETS_API_TOKEN must be set (see .env.example)"
            )

        common_headers = {"User-Agent": _USER_AGENT}

        if method == "GET":
            query = urllib.parse.urlencode({**(params or {}), "token": self._api_token})
            req = urllib.request.Request(
                f"{self._webapp_url}?{query}", method="GET", headers=common_headers
            )
        else:
            payload = {**(body or {}), "token": self._api_token}
            req = urllib.request.Request(
                self._webapp_url,
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
                with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                break
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as err:
                last_err = err
                if attempt < attempts - 1:
                    time.sleep(1)
            except json.JSONDecodeError as err:
                raise SheetsError(f"spreadsheet returned invalid JSON: {err}") from err
        else:
            raise SheetsError(
                f"spreadsheet request failed after {attempts} attempts: {last_err}"
            ) from last_err

        # Apps Script Web Apps always answer HTTP 200 at the transport level, so
        # logical success/failure travels inside the JSON body's "status" field.
        if data.get("status", 200) >= 400:
            raise SheetsError(data.get("error", "unknown spreadsheet error"))
        return data

    def get_user_progress(self, email: Email, lang: str) -> dict[str, ProgressRecord]:
        data = self._request("GET", params={"action": "get", "email": str(email), "lang": lang})
        words = data.get("words", {})
        return {
            word_id: ProgressRecord(
                word_id=word_id,
                confident=entry.get("confident", False),
                shown_count=entry.get("shown_count", 0),
                show=entry.get("show", True),
            )
            for word_id, entry in words.items()
        }

    def upsert_progress(self, email: Email, lang: str, record: ProgressRecord) -> None:
        self._request(
            "POST",
            body={
                "action": "upsert",
                "email": str(email),
                "lang": lang,
                "word_id": record.word_id,
                "confident": record.confident,
                "shown_count": record.shown_count,
                "show": record.show,
            },
        )
