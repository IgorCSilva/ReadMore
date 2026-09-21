from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.use_cases.get_reinforcement_words import GetReinforcementWords
from backend.app.domain.entities import Chapter, Topic, Word
from backend.app.domain.value_objects import LanguagePair

PT_ES = LanguagePair(origin="pt", target="es")


class FakeCatalogRepository(CatalogRepository):
    def __init__(self, chapters_by_lang: dict[LanguagePair, list[Chapter]]) -> None:
        self._chapters_by_lang = chapters_by_lang

    def list_languages(self) -> list[LanguagePair]:
        return list(self._chapters_by_lang.keys())

    def get_words(self, lang: LanguagePair, sentence_lang: str = "target", cue_lang: str = "origin") -> list[Word]:
        raise NotImplementedError

    def get_chapters(self, lang: LanguagePair) -> list[Chapter]:
        return self._chapters_by_lang[lang]


def _topic(number: int, word_ids: list[str]) -> Topic:
    return Topic(topic_id=f"top-{number}", number=number, title="T", description="D", word_ids=word_ids)


def _chapter(number: int, topics: list[Topic]) -> Chapter:
    return Chapter(chapter_id=f"ch-{number}", number=number, title="C", description="D", topics=topics)


CHAPTERS = [
    _chapter(1, [_topic(1, [f"wd{i}-top1" for i in range(1, 9)]), _topic(2, [f"wd{i}-top2" for i in range(1, 9)])]),
]


def test_first_topic_has_no_reinforcement_words_in_any_tab():
    use_case = GetReinforcementWords(FakeCatalogRepository({PT_ES: CHAPTERS}))

    result = use_case.execute(PT_ES, chapter_number=1, topic_number=1)

    assert result == {"reading": [], "dictation": [], "quiz": [], "phrases": []}


def test_later_topic_splits_earlier_topics_words_across_the_four_tabs():
    use_case = GetReinforcementWords(FakeCatalogRepository({PT_ES: CHAPTERS}))

    result = use_case.execute(PT_ES, chapter_number=1, topic_number=2)

    assert set(result.keys()) == {"reading", "dictation", "quiz", "phrases"}
    all_words = [w for words in result.values() for w in words]
    assert all_words
    assert all(w.startswith("wd") and w.endswith("-top1") for w in all_words)


def test_does_not_filter_by_any_per_user_topic_enablement():
    # Unlike GetChapters, this use case has no TopicsRepository dependency —
    # reinforcement selection is a pure function of curriculum position, not
    # of which topics happen to be enabled for a given user.
    use_case = GetReinforcementWords(FakeCatalogRepository({PT_ES: CHAPTERS}))

    result = use_case.execute(PT_ES, chapter_number=1, topic_number=2)

    assert any(words for words in result.values())
