"""GoogleSheetsProgressRepository — reads/writes per-user progress through the
Google Apps Script "Web App" front end (see backend/apps-script/Code.gs).

Same request shapes as backend/server.py's load_user_lang/upsert_progress,
lifted here unchanged. Shared HTTP/retry logic lives in GoogleSheetsClient.
"""
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.domain.entities import ProgressRecord
from backend.app.domain.value_objects import Email
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient


class GoogleSheetsProgressRepository(GoogleSheetsClient, ProgressRepository):
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
