from app.application.ports.catalog_repository import CatalogRepository


class ListLanguages:
    def __init__(self, catalog_repository: CatalogRepository) -> None:
        self._catalog_repository = catalog_repository

    def execute(self) -> list[str]:
        return self._catalog_repository.list_languages()
