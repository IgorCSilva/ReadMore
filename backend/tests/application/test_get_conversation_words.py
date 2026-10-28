from backend.app.application.ports.conversation_words_repository import (
    ConversationWordsRepository,
)
from backend.app.application.use_cases.get_conversation_words import GetConversationWords
from backend.app.domain.entities import ConversationWordUsage
from backend.app.domain.value_objects import Email, LanguagePair

PT_ES = LanguagePair(origin="pt", target="es")
EMAIL = Email("igor.carneiro@gmail.com")


class FakeConversationWordsRepository(ConversationWordsRepository):
    def __init__(self, words: list[ConversationWordUsage]) -> None:
        self._words = words
        self.incremented: list[list[str]] = []

    def get_words(self, email: Email, lang: LanguagePair) -> list[ConversationWordUsage]:
        return list(self._words)

    def increment_words(self, email: Email, lang: LanguagePair, word_ids: list[str]) -> None:
        self.incremented.append(word_ids)


def test_sorts_words_ascending_by_quantity():
    repo = FakeConversationWordsRepository(
        [
            ConversationWordUsage("es-wd-0001", "hola", 5),
            ConversationWordUsage("es-wd-0002", "chao", 0),
            ConversationWordUsage("es-wd-0003", "gracias", 2),
        ]
    )

    result = GetConversationWords(repo).execute(EMAIL, PT_ES)

    assert [w.word_id for w in result] == ["es-wd-0002", "es-wd-0003", "es-wd-0001"]


def test_returns_empty_list_when_the_repository_has_nothing():
    repo = FakeConversationWordsRepository([])

    assert GetConversationWords(repo).execute(EMAIL, PT_ES) == []
