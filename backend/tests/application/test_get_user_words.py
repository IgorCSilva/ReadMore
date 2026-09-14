import pytest

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.application.use_cases.get_user_words import GetUserWords
from backend.app.domain.entities import ProgressRecord, Word
from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import Email


class FakeCatalogRepository(CatalogRepository):
    def __init__(self, words_by_lang: dict[str, list[Word]]) -> None:
        self._words_by_lang = words_by_lang

    def list_languages(self) -> list[str]:
        return list(self._words_by_lang.keys())

    def get_words(self, lang: str) -> list[Word]:
        if lang not in self._words_by_lang:
            raise LanguageNotFoundError(lang)
        return self._words_by_lang[lang]


class FakeProgressRepository(ProgressRepository):
    def __init__(self, records: dict[str, ProgressRecord]) -> None:
        self._records = dict(records)

    def get_user_progress(self, email: Email, lang: str) -> dict[str, ProgressRecord]:
        return dict(self._records)

    def upsert_progress(self, email: Email, lang: str, record: ProgressRecord) -> None:
        raise NotImplementedError


def _word(word_id: str) -> Word:
    return Word(
        word_id=word_id, original="hello", filename="hello.webp", sentence="Hi!", cue="wave"
    )


def test_returns_only_words_the_user_has_progress_for():
    words = [_word("en-0001"), _word("en-0002")]
    progress = {"en-0001": ProgressRecord(word_id="en-0001", confident=False, shown_count=1, show=True)}

    use_case = GetUserWords(
        FakeCatalogRepository({"english": words}),
        FakeProgressRepository(progress),
    )
    result = use_case.execute(Email("igor.carneiro@gmail.com"), "english")

    assert len(result) == 1
    word, record = result[0]
    assert word.word_id == "en-0001"
    assert record.shown_count == 1


def test_raises_for_unknown_language():
    use_case = GetUserWords(
        FakeCatalogRepository({"english": []}),
        FakeProgressRepository({}),
    )
    with pytest.raises(LanguageNotFoundError):
        use_case.execute(Email("igor.carneiro@gmail.com"), "klingon")
