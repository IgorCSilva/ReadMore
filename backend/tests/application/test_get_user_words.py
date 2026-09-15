import pytest

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.application.use_cases.get_user_words import GetUserWords
from backend.app.domain.entities import Chapter, ProgressRecord, Topic, Word
from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import Email, LanguagePair

PT_EN = LanguagePair(origin="pt", target="en")
PT_DE = LanguagePair(origin="pt", target="de")


class FakeCatalogRepository(CatalogRepository):
    def __init__(
        self,
        words_by_lang: dict[LanguagePair, list[Word]],
        chapters_by_lang: dict[LanguagePair, list[Chapter]] | None = None,
    ) -> None:
        self._words_by_lang = words_by_lang
        self._chapters_by_lang = chapters_by_lang or {}
        self.last_call: tuple[LanguagePair, str, str] | None = None

    def list_languages(self) -> list[LanguagePair]:
        return list(self._words_by_lang.keys())

    def get_words(
        self, lang: LanguagePair, sentence_lang: str = "target", cue_lang: str = "origin"
    ) -> list[Word]:
        self.last_call = (lang, sentence_lang, cue_lang)
        if lang not in self._words_by_lang:
            raise LanguageNotFoundError(str(lang))
        return self._words_by_lang[lang]

    def get_chapters(self, lang: LanguagePair) -> list[Chapter]:
        return self._chapters_by_lang.get(lang, [])


class FakeTopicsRepository(TopicsRepository):
    def __init__(self, enabled_topic_ids: set[str]) -> None:
        self._enabled_topic_ids = enabled_topic_ids

    def get_enabled_topic_ids(self, email: Email, lang: LanguagePair) -> set[str]:
        return self._enabled_topic_ids


class FakeProgressRepository(ProgressRepository):
    def __init__(self, records: dict[str, ProgressRecord]) -> None:
        self._records = dict(records)

    def get_user_progress(self, email: Email, lang: LanguagePair) -> dict[str, ProgressRecord]:
        return dict(self._records)

    def upsert_progress(self, email: Email, lang: LanguagePair, record: ProgressRecord) -> None:
        raise NotImplementedError


def _word(word_id: str) -> Word:
    return Word(
        word_id=word_id, original="hello", filename="hello.webp", sentence="Hi!", cue="wave"
    )


def _chapter(topic_id: str, word_ids: list[str]) -> Chapter:
    return Chapter(
        chapter_id="ch-01",
        number=1,
        title="Chapter",
        description="D",
        topics=[
            Topic(
                topic_id=topic_id, number=1, title="T", description="D", word_ids=word_ids
            )
        ],
    )


def test_returns_only_words_in_topics_enabled_for_the_user():
    words = [_word("en-0001"), _word("en-0002")]
    chapters = [_chapter("top-01", ["en-0001"])]

    use_case = GetUserWords(
        FakeCatalogRepository({PT_EN: words}, {PT_EN: chapters}),
        FakeProgressRepository({}),
        FakeTopicsRepository({"top-01"}),
    )
    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

    assert len(result) == 1
    word, record = result[0]
    assert word.word_id == "en-0001"


def test_synthesizes_a_default_progress_record_for_a_word_with_no_progress_row_yet():
    words = [_word("en-0001")]
    chapters = [_chapter("top-01", ["en-0001"])]

    use_case = GetUserWords(
        FakeCatalogRepository({PT_EN: words}, {PT_EN: chapters}),
        FakeProgressRepository({}),
        FakeTopicsRepository({"top-01"}),
    )
    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

    assert len(result) == 1
    _, record = result[0]
    assert record == ProgressRecord(word_id="en-0001", confident=False, shown_count=0, show=True)


def test_uses_existing_progress_record_when_present():
    words = [_word("en-0001")]
    chapters = [_chapter("top-01", ["en-0001"])]
    progress = {
        "en-0001": ProgressRecord(word_id="en-0001", confident=True, shown_count=4, show=False)
    }

    use_case = GetUserWords(
        FakeCatalogRepository({PT_EN: words}, {PT_EN: chapters}),
        FakeProgressRepository(progress),
        FakeTopicsRepository({"top-01"}),
    )
    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

    _, record = result[0]
    assert record.shown_count == 4
    assert record.confident is True
    assert record.show is False


def test_drops_words_whose_topic_is_not_enabled():
    words = [_word("en-0001")]
    chapters = [_chapter("top-01", ["en-0001"])]

    use_case = GetUserWords(
        FakeCatalogRepository({PT_EN: words}, {PT_EN: chapters}),
        FakeProgressRepository({}),
        FakeTopicsRepository(set()),
    )
    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

    assert result == []


def test_raises_for_unknown_language():
    use_case = GetUserWords(
        FakeCatalogRepository({PT_EN: []}),
        FakeProgressRepository({}),
        FakeTopicsRepository(set()),
    )
    with pytest.raises(LanguageNotFoundError):
        use_case.execute(Email("igor.carneiro@gmail.com"), PT_DE)


def test_forwards_sentence_lang_and_cue_lang_to_the_repository():
    repository = FakeCatalogRepository({PT_EN: []})
    use_case = GetUserWords(repository, FakeProgressRepository({}), FakeTopicsRepository(set()))

    use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN, sentence_lang="origin", cue_lang="target")

    assert repository.last_call == (PT_EN, "origin", "target")
