"""GoogleSheetsUsersRepository — reads a user's own rows from the shared
"users" sheet, through the same Apps Script "Web App" front end
GoogleSheetsTopicsRepository reads (backend/apps-script/Code.gs), via the
get_user action. Unlike get_topics (scoped to one (email, language_pair)
row), this scans every row for the email regardless of language_pair.
"""
from backend.app.application.ports.users_repository import UsersRepository
from backend.app.domain.entities import UserRecord
from backend.app.domain.value_objects import Email
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient


class GoogleSheetsUsersRepository(GoogleSheetsClient, UsersRepository):
    def get_user(self, email: Email) -> UserRecord:
        data = self._request("GET", params={"action": "get_user", "email": str(email)})
        language_pairs = frozenset(data.get("language_pairs", []))
        return UserRecord(exists=bool(data.get("exists", False)), language_pairs=language_pairs)
