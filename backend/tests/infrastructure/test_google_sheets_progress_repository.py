import os

import pytest

from backend.app.domain.entities import ProgressRecord
from backend.app.domain.value_objects import Email
from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories.google_sheets_progress_repository import (
    GoogleSheetsProgressRepository,
)

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")


def test_raises_when_webapp_url_or_token_missing():
    repository = GoogleSheetsProgressRepository(webapp_url="", api_token="")
    with pytest.raises(SheetsError):
        repository.get_user_progress(Email("igor.carneiro@gmail.com"), "english")


@pytest.mark.skipif(
    not SHEETS_WEBAPP_URL or not SHEETS_API_TOKEN,
    reason="SHEETS_WEBAPP_URL/SHEETS_API_TOKEN not set — skipping real Google Sheets call",
)
def test_get_user_progress_reads_real_sheet():
    """Read-only on purpose: never calls upsert_progress here, so running the
    test suite can't mutate real user data in the production spreadsheet."""
    repository = GoogleSheetsProgressRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)

    progress = repository.get_user_progress(Email("igor.carneiro@gmail.com"), "english")

    assert isinstance(progress, dict)
    for word_id, record in progress.items():
        assert isinstance(record, ProgressRecord)
        assert record.word_id == word_id
