import os
import time

import pytest

from backend.app.domain.entities import ConversationWordUsage
from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories import (
    google_sheets_conversation_words_repository as conversation_words_module,
)
from backend.app.infrastructure.repositories.google_sheets_conversation_words_repository import (
    GoogleSheetsConversationWordsRepository,
)

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")

PT_ES = LanguagePair(origin="pt", target="es")
EMAIL = Email("igor.carneiro@gmail.com")


@pytest.fixture(autouse=True)
def _clear_cache():
    conversation_words_module._cache.clear()
    yield
    conversation_words_module._cache.clear()


def test_raises_when_webapp_url_or_token_missing():
    repository = GoogleSheetsConversationWordsRepository(webapp_url="", api_token="")
    with pytest.raises(SheetsError):
        repository.get_words(EMAIL, PT_ES)


def test_get_words_maps_rows_to_entities():
    repository = GoogleSheetsConversationWordsRepository("https://example.invalid", "tok")
    repository._request = lambda method, params=None, body=None: {
        "words": [{"word_id": "es-wd-0001", "word": "hola", "quantity": 3}]
    }

    words = repository.get_words(EMAIL, PT_ES)

    assert words == [ConversationWordUsage(word_id="es-wd-0001", word="hola", quantity=3)]


def test_caches_result_and_skips_the_second_request():
    repository = GoogleSheetsConversationWordsRepository("https://example.invalid", "tok")
    calls = []

    def fake_request(method, params=None, body=None):
        calls.append(params)
        return {"words": [{"word_id": "es-wd-0001", "word": "hola", "quantity": 0}]}

    repository._request = fake_request

    first = repository.get_words(EMAIL, PT_ES)
    second = repository.get_words(EMAIL, PT_ES)

    assert first == second
    assert len(calls) == 1


def test_refetches_once_the_cache_entry_expires():
    repository = GoogleSheetsConversationWordsRepository("https://example.invalid", "tok")
    key = (str(EMAIL), PT_ES.target)
    conversation_words_module._cache[key] = (
        [ConversationWordUsage(word_id="stale", word="stale", quantity=0)],
        time.monotonic() - 1,
    )
    calls = []

    def fake_request(method, params=None, body=None):
        calls.append(params)
        return {"words": [{"word_id": "es-wd-0001", "word": "hola", "quantity": 0}]}

    repository._request = fake_request

    result = repository.get_words(EMAIL, PT_ES)

    assert result == [ConversationWordUsage(word_id="es-wd-0001", word="hola", quantity=0)]
    assert len(calls) == 1


def test_increment_words_sends_word_ids_in_the_post_body():
    repository = GoogleSheetsConversationWordsRepository("https://example.invalid", "tok")
    requests = []

    def fake_request(method, params=None, body=None):
        requests.append((method, body))
        return {"updated": 1}

    repository._request = fake_request

    repository.increment_words(EMAIL, PT_ES, ["es-wd-0001"])

    assert requests == [
        (
            "POST",
            {
                "action": "increment_conversation_words",
                "email": str(EMAIL),
                "lang": "es",
                "word_ids": ["es-wd-0001"],
            },
        )
    ]


def test_increment_words_is_a_noop_for_an_empty_list():
    repository = GoogleSheetsConversationWordsRepository("https://example.invalid", "tok")
    repository._request = lambda method, params=None, body=None: pytest.fail(
        "should not call _request for an empty word_ids list"
    )

    repository.increment_words(EMAIL, PT_ES, [])


def test_increment_words_patches_the_cached_entry_instead_of_refetching():
    repository = GoogleSheetsConversationWordsRepository("https://example.invalid", "tok")
    calls = []

    def fake_request(method, params=None, body=None):
        calls.append((method, params, body))
        return {"words": [{"word_id": "es-wd-0001", "word": "hola", "quantity": 0}]}

    repository._request = fake_request
    repository.get_words(EMAIL, PT_ES)  # populate the cache

    repository.increment_words(EMAIL, PT_ES, ["es-wd-0001"])
    result = repository.get_words(EMAIL, PT_ES)

    assert result == [ConversationWordUsage(word_id="es-wd-0001", word="hola", quantity=1)]
    assert len(calls) == 2  # one GET to populate, one POST to increment — no second GET


@pytest.mark.skipif(
    not SHEETS_WEBAPP_URL or not SHEETS_API_TOKEN,
    reason="SHEETS_WEBAPP_URL/SHEETS_API_TOKEN not set — skipping real Google Sheets call",
)
def test_get_words_reads_real_sheet():
    """Read-only on purpose: never calls increment_words here, so running the
    test suite can't mutate real usage counts in the production
    spreadsheet."""
    repository = GoogleSheetsConversationWordsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)

    words = repository.get_words(EMAIL, PT_ES)

    assert isinstance(words, list)
    for usage in words:
        assert isinstance(usage, ConversationWordUsage)
