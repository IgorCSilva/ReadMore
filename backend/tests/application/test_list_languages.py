from app.application.ports.catalog_repository import CatalogRepository
from app.application.use_cases.list_languages import ListLanguages


class FakeCatalogRepository(CatalogRepository):
    def __init__(self, languages: list[str]) -> None:
        self._languages = languages

    def list_languages(self) -> list[str]:
        return self._languages


def test_returns_languages_from_repository():
    use_case = ListLanguages(FakeCatalogRepository(["english", "spanish"]))
    assert use_case.execute() == ["english", "spanish"]


def test_returns_empty_list_when_catalog_has_no_languages():
    use_case = ListLanguages(FakeCatalogRepository([]))
    assert use_case.execute() == []
