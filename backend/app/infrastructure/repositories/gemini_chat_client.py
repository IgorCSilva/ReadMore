"""GeminiChatClient — free-form conversation practice via Google Gemini's
free API tier (generativelanguage.googleapis.com), reached with stdlib
urllib like google_sheets_client.py/google_translate_tts_client.py rather
than adding a new HTTP dependency."""
import json
import time
import urllib.error
import urllib.request

from backend.app.application.ports.chat_port import ChatPort
from backend.app.domain.exceptions import ChatUpstreamError

_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

# Same code->name table as frontend/src/shared/languages.ts's LANGUAGE_NAMES,
# kept in sync by hand since the two sides have no shared module to import.
_LANGUAGE_NAMES = {
    "pt": "Portuguese",
    "en": "English",
    "es": "Spanish",
    "ko": "Korean",
    "zh": "Chinese",
    "fr": "French",
}


def _language_name(code: str) -> str:
    return _LANGUAGE_NAMES.get(code, code)


def _system_instruction(level: str, origin_lang: str, target_lang: str) -> str:
    target_name = _language_name(target_lang)
    origin_name = _language_name(origin_lang)
    return (
        f"You are a friendly conversation partner helping a learner practice "
        f"{target_name}. The learner's CEFR level is {level}: use vocabulary "
        f"and grammar appropriate for that level only. Reply only in "
        f"{target_name}. Keep each reply short (2-4 sentences) and end with "
        f"a question to keep the conversation going. If the learner writes "
        f"in {origin_name} or makes a language mistake, give a brief, gentle "
        f"correction or translation first, then continue the conversation in "
        f"{target_name}."
    )


class GeminiChatClient(ChatPort):
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-flash-lite-latest",
        timeout: int = 20,
        timeout_retries: int = 1,
        retry_backoff: float = 1.0,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._timeout_retries = timeout_retries
        self._retry_backoff = retry_backoff

    def send_message(
        self,
        history: list[tuple[str, str]],
        message: str,
        level: str,
        origin_lang: str,
        target_lang: str,
    ) -> str:
        if not self._api_key:
            raise ChatUpstreamError("GEMINI_API_KEY is not configured")

        contents = [
            {"role": "model" if role == "ai" else "user", "parts": [{"text": content}]}
            for role, content in history
        ]
        contents.append({"role": "user", "parts": [{"text": message}]})

        body = {
            "system_instruction": {"parts": [{"text": _system_instruction(level, origin_lang, target_lang)}]},
            "contents": contents,
        }
        url = _API_URL.format(model=self._model, api_key=self._api_key)
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        attempt = 0
        while True:
            try:
                with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                    payload = json.loads(resp.read())
                break
            except urllib.error.HTTPError as err:
                # HTTPError's body carries Gemini's actual explanation (e.g. a
                # retired model name, or an invalid key) — str(err) alone is
                # just "HTTP Error 404: Not Found", which hides that.
                detail = err.read().decode("utf-8", errors="replace")
                raise ChatUpstreamError(f"HTTP {err.code}: {detail}") from err
            except urllib.error.URLError as err:
                raise ChatUpstreamError(str(err)) from err
            except TimeoutError as err:
                # Python 3.12 raises the builtin TimeoutError for a socket read
                # timeout, not urllib.error.URLError, so it needs its own clause.
                # Gemini's free tier occasionally takes longer than our socket
                # timeout under load, so one retry clears most of these.
                if attempt >= self._timeout_retries:
                    raise ChatUpstreamError(f"timed out after {self._timeout}s") from err
                attempt += 1
                time.sleep(self._retry_backoff)
            except json.JSONDecodeError as err:
                raise ChatUpstreamError(f"malformed JSON response: {err}") from err

        try:
            reply = payload["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as err:
            raise ChatUpstreamError(f"unexpected response shape: {payload}") from err

        reply = reply.strip()
        if not reply:
            raise ChatUpstreamError("Gemini returned an empty reply")
        return reply
