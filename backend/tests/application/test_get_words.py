import pytest

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.use_cases.get_words import GetWords
from backend.app.domain.entities import Chapter, Word
from backend.app.domain.exceptions import LanguageNotFoundError


class FakeCatalogRepository(CatalogRepository):
    """Only get_words is exercised in this file — get_chapters is unused here."""

    def __init__(self, words_by_lang: dict[str, list[Word]]) -> None:
        self._words_by_lang = words_by_lang

    def list_languages(self) -> list[str]:
        return list(self._words_by_lang.keys())

    def get_words(self, lang: str) -> list[Word]:
        if lang not in self._words_by_lang:
            raise LanguageNotFoundError(lang)
        return self._words_by_lang[lang]

    def get_chapters(self, lang: str) -> list[Chapter]:
        raise NotImplementedError


def _word(word_id: str = "en-0001") -> Word:
    return Word(
        word_id=word_id,
        original="hello",
        filename="hello.webp",
        sentence="Hello, how are you?",
        cue="\U0001F44B",
    )


def test_returns_words_for_known_language():
    words = [_word()]
    use_case = GetWords(FakeCatalogRepository({"english": words}))
    assert use_case.execute("english") == words


def test_raises_for_unknown_language():
    use_case = GetWords(FakeCatalogRepository({"english": []}))
    with pytest.raises(LanguageNotFoundError):
        use_case.execute("klingon")
