"""GoogleSheetsProgressRepository — reads/writes per-user progress through the
Google Apps Script "Web App" front end (see backend/apps-script/Code.gs).

Same request shapes as backend/server.py's load_user_lang/upsert_progress,
lifted here unchanged. Shared HTTP/retry logic lives in GoogleSheetsClient.

The real sheet's "lang" column is still the legacy bare-target-language name
("english"), not the LanguagePair this app models internally as of Step 3.1/
3.2 — to_legacy_name() translates right before each request, so this stays
reachable regardless of what format the rest of the app now uses. Superseded
once Phase 4 migrates the sheet schema.
"""
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.domain.entities import ProgressRecord
from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.legacy_language_names import to_legacy_name
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient


class GoogleSheetsProgressRepository(GoogleSheetsClient, ProgressRepository):
    def get_user_progress(self, email: Email, lang: LanguagePair) -> dict[str, ProgressRecord]:
        data = self._request(
            "GET",
            params={"action": "get", "email": str(email), "lang": to_legacy_name(lang)},
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
                "action": "upsert",
                "email": str(email),
                "lang": to_legacy_name(lang),
                "word_id": record.word_id,
                "confident": record.confident,
                "shown_count": record.shown_count,
                "show": record.show,
            },
        )
