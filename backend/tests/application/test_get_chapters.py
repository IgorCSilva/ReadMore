import pytest

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.application.use_cases.get_chapters import GetChapters
from backend.app.domain.entities import Chapter, Topic, Word
from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import Email


class FakeCatalogRepository(CatalogRepository):
    def __init__(self, chapters_by_lang: dict[str, list[Chapter]]) -> None:
        self._chapters_by_lang = chapters_by_lang

    def list_languages(self) -> list[str]:
        return list(self._chapters_by_lang.keys())

    def get_words(self, lang: str) -> list[Word]:
        raise NotImplementedError

    def get_chapters(self, lang: str) -> list[Chapter]:
        if lang not in self._chapters_by_lang:
            raise LanguageNotFoundError(lang)
        return self._chapters_by_lang[lang]


class FakeTopicsRepository(TopicsRepository):
    def __init__(self, enabled_topic_ids: set[str]) -> None:
        self._enabled_topic_ids = enabled_topic_ids

    def get_enabled_topic_ids(self, email: Email, lang: str) -> set[str]:
        return self._enabled_topic_ids


def _topic(topic_id: str) -> Topic:
    return Topic(
        topic_id=topic_id, number=1, title="T", description="D", word_ids=["en-0001"]
    )


def test_drops_topics_not_enabled_for_the_user():
    chapter = Chapter(
        chapter_id="ch-01",
        number=1,
        title="Chapter",
        description="D",
        topics=[_topic("top-01"), _topic("top-02")],
    )
    use_case = GetChapters(
        FakeCatalogRepository({"english": [chapter]}),
        FakeTopicsRepository({"top-01"}),
    )

    result = use_case.execute(Email("igor.carneiro@gmail.com"), "english")

    assert len(result) == 1
    assert [t.topic_id for t in result[0].topics] == ["top-01"]


def test_drops_chapter_entirely_when_no_topics_are_enabled():
    chapter = Chapter(
        chapter_id="ch-01",
        number=1,
        title="Chapter",
        description="D",
        topics=[_topic("top-01")],
    )
    use_case = GetChapters(
        FakeCatalogRepository({"english": [chapter]}),
        FakeTopicsRepository(set()),
    )

    result = use_case.execute(Email("igor.carneiro@gmail.com"), "english")

    assert result == []


def test_raises_for_unknown_language():
    use_case = GetChapters(
        FakeCatalogRepository({"english": []}),
        FakeTopicsRepository(set()),
    )
    with pytest.raises(LanguageNotFoundError):
        use_case.execute(Email("igor.carneiro@gmail.com"), "klingon")
