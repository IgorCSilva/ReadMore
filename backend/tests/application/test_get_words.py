import pytest

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.use_cases.get_words import GetWords
from backend.app.domain.entities import Chapter, Word
from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import LanguagePair

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
    use_case = GetWords(FakeCatalogRepository({PT_EN: words}))
    assert use_case.execute(PT_EN) == words


def test_raises_for_unknown_language():
    use_case = GetWords(FakeCatalogRepository({PT_EN: []}))
    with pytest.raises(LanguageNotFoundError):
        use_case.execute(PT_DE)


def test_forwards_sentence_lang_and_cue_lang_to_the_repository():
    repository = FakeCatalogRepository({PT_EN: []})
    use_case = GetWords(repository)

    use_case.execute(PT_EN, sentence_lang="origin", cue_lang="target")

    assert repository.last_call == (PT_EN, "origin", "target")


def test_defaults_sentence_lang_to_target_and_cue_lang_to_origin():
    repository = FakeCatalogRepository({PT_EN: []})
    use_case = GetWords(repository)

    use_case.execute(PT_EN)

    assert repository.last_call == (PT_EN, "target", "origin")
