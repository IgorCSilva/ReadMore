from backend.app.application.ports.conversation_words_repository import (
    ConversationWordsRepository,
)
from backend.app.domain.entities import ConversationWordUsage
from backend.app.domain.value_objects import Email, LanguagePair


class GetConversationWords:
    def __init__(self, repository: ConversationWordsRepository) -> None:
        self._repository = repository

    def execute(self, email: Email, lang: LanguagePair) -> list[ConversationWordUsage]:
        words = self._repository.get_words(email, lang)
        return sorted(words, key=lambda w: w.quantity)
