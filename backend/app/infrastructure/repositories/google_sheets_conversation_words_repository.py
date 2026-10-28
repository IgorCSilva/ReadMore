"""GoogleSheetsConversationWordsRepository — reads/writes a user's
conversation-word usage through the Google Apps Script "Web App" front end
(see backend/apps-script/Code.gs).

Backed by each (user, target language)'s own "<email>-<target>-progress"
sheet tab — seeded by hand, not auto-created, unlike the flashcard
"<email>-progress" sheet GoogleSheetsProgressRepository uses. Shared
HTTP/retry logic lives in GoogleSheetsClient.

/chat calls get_words on every single message to know which tracked words
to look for, and that sheet can have hundreds of rows, so results are
cached in-process for _CACHE_TTL_SECONDS, keyed by (email, target lang) —
same rationale and shape as google_sheets_topics_repository.py's cache.
increment_words patches the matched entries' quantity directly inside the
cached list afterward (the same "optimistic patch after write" idiom
frontend/src/shared/userWords.ts's patchUserWord uses) instead of
invalidating, so the cache stays accurate without forcing a re-fetch.
"""
import threading
import time

from backend.app.application.ports.conversation_words_repository import (
    ConversationWordsRepository,
)
from backend.app.domain.entities import ConversationWordUsage
from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient

_CACHE_TTL_SECONDS = 120

_cache: dict[tuple[str, str], tuple[list[ConversationWordUsage], float]] = {}
_cache_lock = threading.Lock()


class GoogleSheetsConversationWordsRepository(GoogleSheetsClient, ConversationWordsRepository):
    def get_words(self, email: Email, lang: LanguagePair) -> list[ConversationWordUsage]:
        key = (str(email), lang.target)
        now = time.monotonic()

        with _cache_lock:
            cached = _cache.get(key)
        if cached is not None and cached[1] > now:
            return list(cached[0])

        data = self._request(
            "GET",
            params={"action": "get_conversation_words", "email": str(email), "lang": lang.target},
        )
        words = [
            ConversationWordUsage(
                word_id=row["word_id"], word=row["word"], quantity=int(row.get("quantity") or 0)
            )
            for row in data.get("words", [])
        ]

        with _cache_lock:
            _cache[key] = (words, now + _CACHE_TTL_SECONDS)
        return words

    def increment_words(self, email: Email, lang: LanguagePair, word_ids: list[str]) -> None:
        if not word_ids:
            return
        self._request(
            "POST",
            body={
                "action": "increment_conversation_words",
                "email": str(email),
                "lang": lang.target,
                "word_ids": word_ids,
            },
        )

        key = (str(email), lang.target)
        matched = set(word_ids)
        with _cache_lock:
            cached = _cache.get(key)
            if cached is not None:
                patched = [
                    ConversationWordUsage(w.word_id, w.word, w.quantity + 1)
                    if w.word_id in matched
                    else w
                    for w in cached[0]
                ]
                _cache[key] = (patched, cached[1])
