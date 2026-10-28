from backend.app.application.use_cases.record_conversation_words import RecordConversationWords
from backend.app.domain.entities import ConversationWordUsage
from backend.app.domain.value_objects import Email, LanguagePair
from backend.tests.application.test_get_conversation_words import (
    EMAIL,
    PT_ES,
    FakeConversationWordsRepository,
)


def test_increments_and_excludes_matched_words_from_the_result():
    repo = FakeConversationWordsRepository(
        [
            ConversationWordUsage("es-wd-0001", "hola", 0),
            ConversationWordUsage("es-wd-0002", "chao", 0),
            ConversationWordUsage("es-wd-0003", "gracias", 1),
        ]
    )

    result = RecordConversationWords(repo).execute(EMAIL, PT_ES, "Hola! Gracias por todo.")

    assert [w.word_id for w in result] == ["es-wd-0002"]
    assert len(repo.incremented) == 1
    assert sorted(repo.incremented[0]) == ["es-wd-0001", "es-wd-0003"]


def test_does_not_call_increment_when_nothing_matches():
    repo = FakeConversationWordsRepository([ConversationWordUsage("es-wd-0001", "hola", 0)])

    result = RecordConversationWords(repo).execute(EMAIL, PT_ES, "Buenas tardes")

    assert [w.word_id for w in result] == ["es-wd-0001"]
    assert repo.incremented == []


def test_matches_multi_word_phrases_in_the_message():
    repo = FakeConversationWordsRepository([ConversationWordUsage("es-wd-0003", "de nada", 0)])

    result = RecordConversationWords(repo).execute(EMAIL, PT_ES, "De nada, amigo!")

    assert result == []
    assert repo.incremented == [["es-wd-0003"]]
