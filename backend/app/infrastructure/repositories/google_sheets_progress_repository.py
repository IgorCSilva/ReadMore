"""GoogleSheetsProgressRepository — reads/writes per-user progress through the
Google Apps Script "Web App" front end (see backend/apps-script/Code.gs).

Backed by each user's own "<email>-progress" sheet tab (RESTRUCTURE_REQUIREMENTS.md
§6), keyed directly on the LanguagePair's own string form — no legacy-name
translation needed since the sheet schema itself now stores pair keys.
Shared HTTP/retry logic lives in GoogleSheetsClient.
"""
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.domain.entities import ProgressRecord
from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient


class GoogleSheetsProgressRepository(GoogleSheetsClient, ProgressRepository):
    def get_user_progress(self, email: Email, lang: LanguagePair) -> dict[str, ProgressRecord]:
        data = self._request(
            "GET",
            params={"action": "get_progress", "email": str(email), "lang": str(lang)},
        )
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

    def upsert_progress(self, email: Email, lang: LanguagePair, record: ProgressRecord) -> None:
        self._request(
            "POST",
            body={
                "action": "upsert_progress",
                "email": str(email),
                "lang": str(lang),
                "word_id": record.word_id,
                "confident": record.confident,
                "shown_count": record.shown_count,
                "show": record.show,
            },
        )
