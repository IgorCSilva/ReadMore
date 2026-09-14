"""Concrete CatalogRepository implementation, reading catalog.json from disk."""
import json
from pathlib import Path

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.domain.entities import Word
from backend.app.domain.exceptions import LanguageNotFoundError


class JsonCatalogRepository(CatalogRepository):
    def __init__(self, catalog_path: Path) -> None:
        self._catalog_path = catalog_path

    def _load(self) -> dict:
        with open(self._catalog_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_languages(self) -> list[str]:
        catalog = self._load()
        return list(catalog.keys())

    def get_words(self, lang: str) -> list[Word]:
        catalog = self._load()
        if lang not in catalog:
            raise LanguageNotFoundError(lang)
        return [
            Word(
                word_id=w["word_id"],
                original=w["original"],
                filename=w["filename"],
                sentence=w["sentence"],
                cue=w["cue"],
            )
            for w in catalog[lang]["words"]
        ]
