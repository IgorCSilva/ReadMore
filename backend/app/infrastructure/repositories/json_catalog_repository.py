"""Concrete CatalogRepository implementation, reading catalog.json from disk."""
import json
from pathlib import Path

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.domain.entities import Chapter, Text, Topic, Word
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

    def get_chapters(self, lang: str) -> list[Chapter]:
        catalog = self._load()
        if lang not in catalog:
            raise LanguageNotFoundError(lang)
        return [self._to_chapter(c) for c in catalog[lang].get("chapters", [])]

    @staticmethod
    def _to_chapter(data: dict) -> Chapter:
        return Chapter(
            chapter_id=data["chapter_id"],
            number=data["number"],
            title=data["title"],
            description=data["description"],
            topics=[JsonCatalogRepository._to_topic(t) for t in data.get("topics", [])],
            status=data.get("status", "ready"),
        )

    @staticmethod
    def _to_topic(data: dict) -> Topic:
        return Topic(
            topic_id=data["topic_id"],
            number=data["number"],
            title=data["title"],
            description=data["description"],
            word_ids=data.get("word_ids", []),
            texts=[JsonCatalogRepository._to_text(t) for t in data.get("texts", [])],
            status=data.get("status", "ready"),
            exercises=data.get("exercises", []),
        )

    @staticmethod
    def _to_text(data: dict) -> Text:
        return Text(
            text_id=data["text_id"],
            number=data["number"],
            title=data["title"],
            body=data["body"],
        )
