import os

import pytest

from backend.app.domain.value_objects import Email
from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories.google_sheets_users_repository import (
    GoogleSheetsUsersRepository,
)

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")


def test_raises_when_webapp_url_or_token_missing():
    repository = GoogleSheetsUsersRepository(webapp_url="", api_token="")
    with pytest.raises(SheetsError):
        repository.get_user(Email("igor.carneiro@gmail.com"))


@pytest.mark.skipif(
    not SHEETS_WEBAPP_URL or not SHEETS_API_TOKEN,
    reason="SHEETS_WEBAPP_URL/SHEETS_API_TOKEN not set — skipping real Google Sheets call",
)
def test_get_user_reads_real_sheet():
    repository = GoogleSheetsUsersRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)

    known = repository.get_user(Email("igor.carneiro@gmail.com"))
    assert known.exists is True
    assert len(known.language_pairs) > 0

    unknown = repository.get_user(Email("definitely-not-a-user@example.com"))
    assert unknown.exists is False
    assert unknown.language_pairs == frozenset()


def test_builds_a_record_from_the_action_response():
    repository = GoogleSheetsUsersRepository("https://example.invalid", "tok")
    repository._request = lambda method, params=None, body=None: {
        "exists": True,
        "language_pairs": ["pt-en", "pt-es"],
    }

    result = repository.get_user(Email("igor.carneiro@gmail.com"))

    assert result.exists is True
    assert result.language_pairs == frozenset({"pt-en", "pt-es"})


def test_defaults_to_a_non_existent_record_when_fields_are_missing():
    repository = GoogleSheetsUsersRepository("https://example.invalid", "tok")
    repository._request = lambda method, params=None, body=None: {}

    result = repository.get_user(Email("nobody@gmail.com"))

    assert result.exists is False
    assert result.language_pairs == frozenset()
