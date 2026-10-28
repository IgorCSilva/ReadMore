from backend.app.application.ports.conversation_words_repository import (
    ConversationWordsRepository,
)
from backend.app.application.services.conversation_word_matching import match_word_ids
from backend.app.domain.entities import ConversationWordUsage
from backend.app.domain.value_objects import Email, LanguagePair


class RecordConversationWords:
    def __init__(self, repository: ConversationWordsRepository) -> None:
        self._repository = repository

    def execute(
        self, email: Email, lang: LanguagePair, message: str
    ) -> list[ConversationWordUsage]:
        words = self._repository.get_words(email, lang)
        matched_ids = set(match_word_ids(message, words, lang.target))
        if matched_ids:
            self._repository.increment_words(email, lang, list(matched_ids))

        # Matched words are excluded outright (rather than re-sorted by
        # their new quantity) so a word just used in this message visibly
        # disappears from the caller's display immediately, instead of only
        # dropping out once enough other words also reach its new quantity.
        remaining = [w for w in words if w.word_id not in matched_ids]
        return sorted(remaining, key=lambda w: w.quantity)
