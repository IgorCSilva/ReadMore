import pytest

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.application.use_cases.get_user_words import GetUserWords
from backend.app.domain.entities import Chapter, ProgressRecord, Word
from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import Email, LanguagePair

PT_EN = LanguagePair(origin="pt", target="en")
PT_DE = LanguagePair(origin="pt", target="de")


class FakeCatalogRepository(CatalogRepository):
    """Only get_words is exercised in this file — get_chapters is unused here."""

    def __init__(self, words_by_lang: dict[LanguagePair, list[Word]]) -> None:
        self._words_by_lang = words_by_lang
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
        raise NotImplementedError


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


def test_returns_only_words_the_user_has_progress_for():
    words = [_word("en-0001"), _word("en-0002")]
    progress = {"en-0001": ProgressRecord(word_id="en-0001", confident=False, shown_count=1, show=True)}

    use_case = GetUserWords(
        FakeCatalogRepository({PT_EN: words}),
        FakeProgressRepository(progress),
    )
    result = use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN)

    assert len(result) == 1
    word, record = result[0]
    assert word.word_id == "en-0001"
    assert record.shown_count == 1


def test_raises_for_unknown_language():
    use_case = GetUserWords(
        FakeCatalogRepository({PT_EN: []}),
        FakeProgressRepository({}),
    )
    with pytest.raises(LanguageNotFoundError):
        use_case.execute(Email("igor.carneiro@gmail.com"), PT_DE)


def test_forwards_sentence_lang_and_cue_lang_to_the_repository():
    repository = FakeCatalogRepository({PT_EN: []})
    use_case = GetUserWords(repository, FakeProgressRepository({}))

    use_case.execute(Email("igor.carneiro@gmail.com"), PT_EN, sentence_lang="origin", cue_lang="target")

    assert repository.last_call == (PT_EN, "origin", "target")
