import pytest

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.application.use_cases.increment_shown_count import IncrementShownCount
from backend.app.domain.entities import Chapter, ProgressRecord, Topic, Word
from backend.app.domain.exceptions import WordNotAssignedError
from backend.app.domain.value_objects import Email, LanguagePair

PT_EN = LanguagePair(origin="pt", target="en")


class FakeCatalogRepository(CatalogRepository):
    def __init__(self, chapters: list[Chapter]) -> None:
        self._chapters = chapters

    def list_languages(self) -> list[LanguagePair]:
        raise NotImplementedError

    def get_words(
        self, lang: LanguagePair, sentence_lang: str = "target", cue_lang: str = "origin"
    ) -> list[Word]:
        raise NotImplementedError

    def get_chapters(self, lang: LanguagePair) -> list[Chapter]:
        return self._chapters


class FakeTopicsRepository(TopicsRepository):
    def __init__(self, enabled_topic_ids: set[str]) -> None:
        self._enabled_topic_ids = enabled_topic_ids

    def get_enabled_topic_ids(self, email: Email, lang: LanguagePair) -> set[str]:
        return self._enabled_topic_ids


class FakeProgressRepository(ProgressRepository):
    def __init__(self, records: dict[str, ProgressRecord]) -> None:
        self._records = dict(records)
        self.upserted: list[ProgressRecord] = []

    def get_user_progress(self, email: Email, lang: LanguagePair) -> dict[str, ProgressRecord]:
        return dict(self._records)

    def upsert_progress(self, email: Email, lang: LanguagePair, record: ProgressRecord) -> None:
        self._records[record.word_id] = record
        self.upserted.append(record)


def _chapter_enabling(topic_id: str, word_ids: list[str]) -> Chapter:
    return Chapter(
        chapter_id="ch-01",
        number=1,
        title="Chapter",
        description="D",
        topics=[Topic(topic_id=topic_id, number=1, title="T", description="D", word_ids=word_ids)],
    )


def test_increments_shown_count_and_persists_other_fields_unchanged():
    record = ProgressRecord(word_id="en-0001", confident=True, shown_count=2, show=True)
    repo = FakeProgressRepository({"en-0001": record})
    use_case = IncrementShownCount(
        FakeCatalogRepository([_chapter_enabling("top-01", ["en-0001"])]),
        FakeTopicsRepository({"top-01"}),
        repo,
    )

    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN, "en-0001")

    assert result == 3
    assert repo.upserted[-1] == ProgressRecord(
        word_id="en-0001", confident=True, shown_count=3, show=True
    )


def test_creates_a_progress_row_for_a_word_with_no_prior_progress():
    repo = FakeProgressRepository({})
    use_case = IncrementShownCount(
        FakeCatalogRepository([_chapter_enabling("top-01", ["en-0001"])]),
        FakeTopicsRepository({"top-01"}),
        repo,
    )

    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN, "en-0001")

    assert result == 1
    assert repo.upserted[-1] == ProgressRecord(
        word_id="en-0001", confident=False, shown_count=1, show=True
    )


def test_raises_for_word_whose_topic_is_not_enabled_for_the_user():
    repo = FakeProgressRepository({})
    use_case = IncrementShownCount(
        FakeCatalogRepository([_chapter_enabling("top-01", ["en-0001"])]),
        FakeTopicsRepository(set()),
        repo,
    )

    with pytest.raises(WordNotAssignedError):
        use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN, "en-0001")
