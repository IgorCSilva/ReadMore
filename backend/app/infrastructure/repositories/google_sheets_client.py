"""Shared HTTP client behavior for Google Sheets-backed repositories.

Both GoogleSheetsProgressRepository and GoogleSheetsTopicsRepository talk to
the same Apps Script "Web App" front end (backend/apps-script/Code.gs) over
the same token-authenticated GET/POST contract — this base class holds that
shared request/retry/error-handling logic (lifted from backend/server.py's
_sheets_request, unchanged) so it isn't duplicated per repository.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

# Google's infrastructure appears to block/throttle the default
# "Python-urllib/x.y" User-Agent for this redirect chain (exec -> content),
# causing intermittent timeouts/404s. A browser-like UA avoids that entirely.
_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


class SheetsError(Exception):
    pass


class GoogleSheetsClient:
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
