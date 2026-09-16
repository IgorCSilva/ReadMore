import pytest

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.corrections_repository import CorrectionsRepository
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.application.use_cases.get_chapters import GetChapters
from backend.app.domain.entities import Chapter, Correction, Text, Topic, Word
from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import Email, LanguagePair

PT_EN = LanguagePair(origin="pt", target="en")
PT_DE = LanguagePair(origin="pt", target="de")


class FakeCorrectionsRepository(CorrectionsRepository):
    def __init__(self, corrections: list[Correction] | None = None) -> None:
        self._corrections = corrections or []

    def list_corrections(self) -> list[Correction]:
        return self._corrections

    def add_correction(self, chapter_number, topic_number, lang, current, correction) -> None:
        raise NotImplementedError


class FailingCorrectionsRepository(CorrectionsRepository):
    def list_corrections(self) -> list[Correction]:
        raise RuntimeError("corrections sheet unavailable")

    def add_correction(self, chapter_number, topic_number, lang, current, correction) -> None:
        raise NotImplementedError


class FakeCatalogRepository(CatalogRepository):
    def __init__(self, chapters_by_lang: dict[LanguagePair, list[Chapter]]) -> None:
        self._chapters_by_lang = chapters_by_lang

    def list_languages(self) -> list[LanguagePair]:
        return list(self._chapters_by_lang.keys())

    def get_words(self, lang: LanguagePair) -> list[Word]:
        raise NotImplementedError

    def get_chapters(self, lang: LanguagePair) -> list[Chapter]:
        if lang not in self._chapters_by_lang:
            raise LanguageNotFoundError(str(lang))
        return self._chapters_by_lang[lang]


class FakeTopicsRepository(TopicsRepository):
    def __init__(self, enabled_topic_ids: set[str]) -> None:
        self._enabled_topic_ids = enabled_topic_ids

    def get_enabled_topic_ids(self, email: Email, lang: LanguagePair) -> set[str]:
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
        FakeCatalogRepository({PT_EN: [chapter]}),
        FakeTopicsRepository({"top-01"}),
        FakeCorrectionsRepository(),
    )

    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

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
        FakeCatalogRepository({PT_EN: [chapter]}),
        FakeTopicsRepository(set()),
        FakeCorrectionsRepository(),
    )

    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

    assert result == []


def test_raises_for_unknown_language():
    use_case = GetChapters(
        FakeCatalogRepository({PT_EN: []}),
        FakeTopicsRepository(set()),
        FakeCorrectionsRepository(),
    )
    with pytest.raises(LanguageNotFoundError):
        use_case.execute(Email("igor.carneiro@gmail.com"), PT_DE)


def test_applies_corrections_to_visible_topics():
    topic = Topic(
        topic_id="top-01",
        number=4,
        title="T",
        description="D",
        word_ids=["en-0001"],
        texts=[Text(text_id="txt-01", number=1, title="Title", body="avó says hi")],
        exercises=[{"sentence": "avó says hi", "items": [{"answer": "avó"}]}],
    )
    chapter = Chapter(
        chapter_id="ch-02", number=2, title="Chapter", description="D", topics=[topic]
    )
    correction = Correction(
        chapter_number=2, topic_number=4, current=["avó"], correction=["abuela"]
    )
    use_case = GetChapters(
        FakeCatalogRepository({PT_EN: [chapter]}),
        FakeTopicsRepository({"top-01"}),
        FakeCorrectionsRepository([correction]),
    )

    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

    result_topic = result[0].topics[0]
    assert result_topic.texts[0].body == "**abuela** says hi"
    assert result_topic.exercises[0]["sentence"] == "**abuela** says hi"
    assert result_topic.exercises[0]["items"][0]["answer"] == "**abuela**"


def test_serves_chapters_unmodified_when_corrections_lookup_fails():
    topic = Topic(topic_id="top-01", number=1, title="T", description="D", word_ids=["en-0001"])
    chapter = Chapter(
        chapter_id="ch-01", number=1, title="Chapter", description="D", topics=[topic]
    )
    use_case = GetChapters(
        FakeCatalogRepository({PT_EN: [chapter]}),
        FakeTopicsRepository({"top-01"}),
        FailingCorrectionsRepository(),
    )

    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

    assert [t.topic_id for t in result[0].topics] == ["top-01"]
