from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.domain.value_objects import LanguagePair


class ListLanguages:
    def __init__(self, catalog_repository: CatalogRepository) -> None:
        self._catalog_repository = catalog_repository

    def execute(self) -> list[LanguagePair]:
        return self._catalog_repository.list_languages()
