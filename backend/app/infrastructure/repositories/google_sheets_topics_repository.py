"""GoogleSheetsTopicsRepository — reads which topics are enabled for a user
through the Google Apps Script "Web App" front end.

Backed by the shared "users" sheet tab (RESTRUCTURE_REQUIREMENTS.md §6): one
row per (email, language_pair) with a comma-separated topic_ids list, keyed
directly on the LanguagePair's own string form. Shared HTTP/retry logic
lives in GoogleSheetsClient.
"""
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient


class GoogleSheetsTopicsRepository(GoogleSheetsClient, TopicsRepository):
    def get_enabled_topic_ids(self, email: Email, lang: LanguagePair) -> set[str]:
        data = self._request(
            "GET",
            params={"action": "get_topics", "email": str(email), "lang": str(lang)},
        )
        return set(data.get("topic_ids", []))
