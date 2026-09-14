"""Concrete CatalogRepository implementation, reading catalog.json from disk."""
import json
from pathlib import Path

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.domain.entities import Chapter, Text, Topic, Word
from backend.app.domain.exceptions import LanguageNotFoundError

# catalog.json is keyed by explicit origin-target language pair (e.g. "pt-en")
# as of RESTRUCTURE_PLAN.md Step 3.1, but everything outside this repository
# (use cases, controllers, the Sheets-backed repositories, the frontend) still
# speaks the legacy bare-target-language name ("english") — the Sheets
# progress/topics data is keyed on that name too, and migrating it is coupled
# to Phase 4's sheet schema redesign, so it isn't done yet. This map
# translates between the two so nothing else in the stack has to know
# catalog.json's on-disk shape changed; Step 3.2 replaces this with proper
# LanguagePair propagation once Phase 4 lands.
LEGACY_NAME_TO_PAIR_KEY = {
    "english": "pt-en",
    "spanish": "pt-es",
}
PAIR_KEY_TO_LEGACY_NAME = {pair_key: name for name, pair_key in LEGACY_NAME_TO_PAIR_KEY.items()}


class JsonCatalogRepository(CatalogRepository):
    def __init__(self, catalog_path: Path) -> None:
        self._catalog_path = catalog_path

    def _load(self) -> dict:
        with open(self._catalog_path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def _catalog_key(lang: str) -> str:
        """Legacy names ("english") resolve to their pair key ("pt-en") for
        catalog.json lookups; a pair key (or any other future, unmapped key)
        passes through unchanged."""
        return LEGACY_NAME_TO_PAIR_KEY.get(lang, lang)

    def list_languages(self) -> list[str]:
        catalog = self._load()
        return [PAIR_KEY_TO_LEGACY_NAME.get(key, key) for key in catalog.keys()]

    def get_words(self, lang: str) -> list[Word]:
        catalog = self._load()
        key = self._catalog_key(lang)
        if key not in catalog:
            raise LanguageNotFoundError(lang)
        return [
            Word(
                word_id=w["word_id"],
                original=w["original"],
                filename=w["filename"],
                sentence=w["sentence"],
                cue=w["cue"],
            )
            for w in catalog[key]["words"]
        ]

    def get_chapters(self, lang: str) -> list[Chapter]:
        catalog = self._load()
        key = self._catalog_key(lang)
        if key not in catalog:
            raise LanguageNotFoundError(lang)
        return [self._to_chapter(c) for c in catalog[key].get("chapters", [])]

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
