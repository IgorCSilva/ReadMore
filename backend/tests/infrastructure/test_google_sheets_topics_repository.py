import os
import time

import pytest

from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories import google_sheets_topics_repository as topics_repo_module
from backend.app.infrastructure.repositories.google_sheets_topics_repository import (
    GoogleSheetsTopicsRepository,
)

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")

PT_EN = LanguagePair(origin="pt", target="en")


@pytest.fixture(autouse=True)
def _clear_topics_cache():
    topics_repo_module._cache.clear()
    yield
    topics_repo_module._cache.clear()


def test_raises_when_webapp_url_or_token_missing():
    repository = GoogleSheetsTopicsRepository(webapp_url="", api_token="")
    with pytest.raises(SheetsError):
        repository.get_enabled_topic_ids(Email("igor.carneiro@gmail.com"), PT_EN)


@pytest.mark.skipif(
    not SHEETS_WEBAPP_URL or not SHEETS_API_TOKEN,
    reason="SHEETS_WEBAPP_URL/SHEETS_API_TOKEN not set — skipping real Google Sheets call",
)
def test_get_enabled_topic_ids_reads_real_sheet():
    """Read-only — this action has no corresponding write, so there's nothing
    to restore afterward. A non-empty result proves this is actually reaching
    igor.carneiro@gmail.com's real row in the "users" sheet."""
    repository = GoogleSheetsTopicsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)

    topic_ids = repository.get_enabled_topic_ids(Email("igor.carneiro@gmail.com"), PT_EN)

    assert isinstance(topic_ids, set)
    assert len(topic_ids) > 0


def test_caches_result_and_skips_the_second_request():
    repository = GoogleSheetsTopicsRepository("https://example.invalid", "tok")
    calls = []

    def fake_request(method, params=None, body=None):
        calls.append(params)
        return {"topic_ids": ["top-01"]}

    repository._request = fake_request

    first = repository.get_enabled_topic_ids(Email("igor.carneiro@gmail.com"), PT_EN)
    second = repository.get_enabled_topic_ids(Email("igor.carneiro@gmail.com"), PT_EN)

    assert first == {"top-01"}
    assert second == {"top-01"}
    assert len(calls) == 1


def test_refetches_once_the_cache_entry_expires():
    repository = GoogleSheetsTopicsRepository("https://example.invalid", "tok")
    key = (str(Email("igor.carneiro@gmail.com")), str(PT_EN))
    topics_repo_module._cache[key] = ({"stale"}, time.monotonic() - 1)
    calls = []

    def fake_request(method, params=None, body=None):
        calls.append(params)
        return {"topic_ids": ["fresh"]}

    repository._request = fake_request

    result = repository.get_enabled_topic_ids(Email("igor.carneiro@gmail.com"), PT_EN)

    assert result == {"fresh"}
    assert len(calls) == 1
