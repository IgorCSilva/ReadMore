from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.domain.entities import Word
from backend.app.domain.value_objects import LanguagePair


class GetWords:
    def __init__(self, catalog_repository: CatalogRepository) -> None:
        self._catalog_repository = catalog_repository

    def execute(self, lang: LanguagePair) -> list[Word]:
        return self._catalog_repository.get_words(lang)
