import os

import pytest

from backend.app.domain.value_objects import Email
from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories.google_sheets_topics_repository import (
    GoogleSheetsTopicsRepository,
)

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")


def test_raises_when_webapp_url_or_token_missing():
    repository = GoogleSheetsTopicsRepository(webapp_url="", api_token="")
    with pytest.raises(SheetsError):
        repository.get_enabled_topic_ids(Email("igor.carneiro@gmail.com"), "english")


@pytest.mark.skipif(
    not SHEETS_WEBAPP_URL or not SHEETS_API_TOKEN,
    reason="SHEETS_WEBAPP_URL/SHEETS_API_TOKEN not set — skipping real Google Sheets call",
)
def test_get_enabled_topic_ids_reads_real_sheet():
    """Read-only — this action has no corresponding write, so there's nothing
    to restore afterward."""
    repository = GoogleSheetsTopicsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)

    topic_ids = repository.get_enabled_topic_ids(Email("igor.carneiro@gmail.com"), "english")

    assert isinstance(topic_ids, set)
