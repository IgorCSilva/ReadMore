"""GoogleSheetsTopicsRepository — reads which topics are enabled for a user
through the Google Apps Script "Web App" front end.

Same request shape as backend/server.py's load_enabled_topics, lifted here
unchanged. Shared HTTP/retry logic lives in GoogleSheetsClient.
"""
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.domain.value_objects import Email
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient


class GoogleSheetsTopicsRepository(GoogleSheetsClient, TopicsRepository):
    def get_enabled_topic_ids(self, email: Email, lang: str) -> set[str]:
        data = self._request(
            "GET", params={"action": "get_topics", "email": str(email), "lang": lang}
        )
        return set(data.get("topic_ids", []))
