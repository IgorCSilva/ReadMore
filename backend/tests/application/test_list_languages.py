from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.use_cases.list_languages import ListLanguages
from backend.app.domain.entities import Chapter, Word
from backend.app.domain.value_objects import LanguagePair


class FakeCatalogRepository(CatalogRepository):
    """Only list_languages is exercised in this file — the rest is unused here."""

    def __init__(self, languages: list[LanguagePair]) -> None:
        self._languages = languages

    def list_languages(self) -> list[LanguagePair]:
        return self._languages

    def get_words(self, lang: LanguagePair) -> list[Word]:
        raise NotImplementedError

    def get_chapters(self, lang: LanguagePair) -> list[Chapter]:
        raise NotImplementedError


def test_returns_languages_from_repository():
    pt_en = LanguagePair(origin="pt", target="en")
    pt_es = LanguagePair(origin="pt", target="es")
    use_case = ListLanguages(FakeCatalogRepository([pt_en, pt_es]))
    assert use_case.execute() == [pt_en, pt_es]


def test_returns_empty_list_when_catalog_has_no_languages():
    use_case = ListLanguages(FakeCatalogRepository([]))
    assert use_case.execute() == []
