import os

import pytest

from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories.google_sheets_corrections_repository import (
    GoogleSheetsCorrectionsRepository,
)

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")


def test_raises_when_webapp_url_or_token_missing():
    repository = GoogleSheetsCorrectionsRepository(webapp_url="", api_token="")
    with pytest.raises(SheetsError):
        repository.list_corrections()


@pytest.mark.skipif(
    not SHEETS_WEBAPP_URL or not SHEETS_API_TOKEN,
    reason="SHEETS_WEBAPP_URL/SHEETS_API_TOKEN not set — skipping real Google Sheets call",
)
def test_list_corrections_reads_real_sheet():
    """Read-only on purpose: never calls add_correction here, so running the
    test suite can't write test data into the real spreadsheet."""
    repository = GoogleSheetsCorrectionsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)

    corrections = repository.list_corrections()

    assert isinstance(corrections, list)
