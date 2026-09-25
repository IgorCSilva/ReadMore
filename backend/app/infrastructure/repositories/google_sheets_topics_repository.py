"""GoogleSheetsTopicsRepository — reads which topics are enabled for a user
through the Google Apps Script "Web App" front end.

Backed by the shared "users" sheet tab (RESTRUCTURE_REQUIREMENTS.md §6): one
row per (email, language_pair) with a comma-separated topic_ids list, keyed
directly on the LanguagePair's own string form. Shared HTTP/retry logic
lives in GoogleSheetsClient.

Every /chapters (and word-progress) request calls get_enabled_topic_ids, so
results are cached in-process for _CACHE_TTL_SECONDS, keyed by (email, lang).
The cache dict is module-level rather than an instance attribute because
main.py's Depends() builds a fresh repository per request — only a
module-level store survives across requests. Topic enablement is edited by
hand in the sheet and changes rarely, so a short staleness window here is a
good trade for turning a live Sheets round trip into a memory lookup on
every request but the first one per TTL window.
"""
import threading
import time

from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient

_CACHE_TTL_SECONDS = 120

_cache: dict[tuple[str, str], tuple[set[str], float]] = {}
_cache_lock = threading.Lock()


class GoogleSheetsTopicsRepository(GoogleSheetsClient, TopicsRepository):
    def get_enabled_topic_ids(self, email: Email, lang: LanguagePair) -> set[str]:
        key = (str(email), str(lang))
        now = time.monotonic()

        with _cache_lock:
            cached = _cache.get(key)
        if cached is not None and cached[1] > now:
            return cached[0]

        data = self._request(
            "GET",
            params={"action": "get_topics", "email": str(email), "lang": str(lang)},
        )
        topic_ids = set(data.get("topic_ids", []))

        with _cache_lock:
            _cache[key] = (topic_ids, now + _CACHE_TTL_SECONDS)
        return topic_ids
