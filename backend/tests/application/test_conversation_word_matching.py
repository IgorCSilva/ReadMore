from backend.app.application.services.conversation_word_matching import match_word_ids
from backend.app.domain.entities import ConversationWordUsage


def _usage(word_id: str, word: str) -> ConversationWordUsage:
    return ConversationWordUsage(word_id=word_id, word=word, quantity=0)


def test_matches_a_single_tracked_word():
    words = [_usage("es-wd-0001", "hola"), _usage("es-wd-0002", "chao")]

    assert match_word_ids("Hola, ¿cómo estás?", words, "es") == ["es-wd-0001"]


def test_matches_a_multi_word_phrase():
    words = [_usage("es-wd-0003", "de nada")]

    assert match_word_ids("Muchas gracias! De nada, amigo.", words, "es") == ["es-wd-0003"]


def test_is_case_insensitive():
    words = [_usage("es-wd-0001", "hola")]

    assert match_word_ids("HOLA!", words, "es") == ["es-wd-0001"]


def test_does_not_match_a_word_as_a_substring_of_another_word():
    words = [_usage("es-wd-0001", "nada")]

    assert match_word_ids("Ella anadea por el lago.", words, "es") == []


def test_allows_overlapping_matches_for_a_phrase_and_its_own_words():
    words = [_usage("es-wd-0001", "nada"), _usage("es-wd-0002", "de nada")]

    matched = match_word_ids("De nada!", words, "es")

    assert set(matched) == {"es-wd-0001", "es-wd-0002"}


def test_returns_empty_list_when_nothing_matches():
    words = [_usage("es-wd-0001", "hola")]

    assert match_word_ids("Buenas tardes", words, "es") == []


def test_uses_the_korean_boundary_strategy_for_a_korean_target():
    # Korean glues particles onto the preceding word with no space, so only
    # the start needs anchoring (see domain/text_boundaries.py) — "학교"
    # should match inside "학교에" but not inside "중학교".
    words = [_usage("ko-wd-0001", "학교")]

    assert match_word_ids("학교에 가요", words, "ko") == ["ko-wd-0001"]
    assert match_word_ids("중학교 학생이에요", words, "ko") == []
