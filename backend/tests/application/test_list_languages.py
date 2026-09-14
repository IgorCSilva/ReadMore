from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.use_cases.list_languages import ListLanguages
from backend.app.domain.entities import Chapter, Word


class FakeCatalogRepository(CatalogRepository):
    """Only list_languages is exercised in this file — the rest is unused here."""

    def __init__(self, languages: list[str]) -> None:
        self._languages = languages

    def list_languages(self) -> list[str]:
        return self._languages

    def get_words(self, lang: str) -> list[Word]:
        raise NotImplementedError

    def get_chapters(self, lang: str) -> list[Chapter]:
        raise NotImplementedError


def test_returns_languages_from_repository():
    use_case = ListLanguages(FakeCatalogRepository(["english", "spanish"]))
    assert use_case.execute() == ["english", "spanish"]


def test_returns_empty_list_when_catalog_has_no_languages():
    use_case = ListLanguages(FakeCatalogRepository([]))
    assert use_case.execute() == []
