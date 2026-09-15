"""Concrete CatalogRepository implementation, reading from four JSON files
under backend/words/ and backend/content/.

As of the words-catalog redesign (see contents/language_reading_journey_phases/
readmore_adaptation/'s phase docs for the content-authoring side), catalog.json
holds only a shared, concept-based `words` list — one row per concept, with a
field per TARGET language it has a spelling for (e.g. row["en"] = "hello") —
origin is dropped from the key since one target language never appears under
two different origins in this app so far. Everything pair-specific lives
elsewhere: content/<pair>.json (chapters/topics/texts/exercises), sentences.json
and cues.json (flat, keyed by "<lang-code>_<word_id>" — lang-code is either the
pair's origin or target code, letting the same word_id resolve either variant).
"""
import json
from pathlib import Path

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.domain.entities import Chapter, Text, Topic, Word
from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import LanguagePair


def _resolve_lang_code(pair: LanguagePair, choice: str) -> str:
    if choice == "target":
        return pair.target
    if choice == "origin":
        return pair.origin
    raise ValueError(f"invalid language choice: {choice!r} (expected 'origin' or 'target')")


class JsonCatalogRepository(CatalogRepository):
    def __init__(
        self,
        catalog_path: Path,
        content_dir: Path,
        sentences_path: Path,
        cues_path: Path,
    ) -> None:
        self._catalog_path = catalog_path
        self._content_dir = content_dir
        self._sentences_path = sentences_path
        self._cues_path = cues_path

    def _load_json(self, path: Path) -> dict:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _load_words(self) -> list[dict]:
        return self._load_json(self._catalog_path)["words"]

    def _load_content(self, lang: LanguagePair) -> dict:
        path = self._content_dir / f"{lang}.json"
        if not path.exists():
            raise LanguageNotFoundError(str(lang))
        return self._load_json(path)

    def list_languages(self) -> list[LanguagePair]:
        return [
            LanguagePair.parse(path.stem)
            for path in sorted(self._content_dir.glob("*.json"))
        ]

    def get_words(
        self, lang: LanguagePair, sentence_lang: str = "target", cue_lang: str = "origin"
    ) -> list[Word]:
        pair_key = str(lang)
        # catalog.json rows key their spelling by target-language code alone
        # (e.g. "en", not "pt-en") — origin is dropped since, for this app so
        # far, one target language never appears under two different origins.
        target_code = lang.target
        rows = [w for w in self._load_words() if target_code in w]
        if not rows and not (self._content_dir / f"{pair_key}.json").exists():
            raise LanguageNotFoundError(pair_key)

        sentences = self._load_json(self._sentences_path)
        cues = self._load_json(self._cues_path)
        sentence_code = _resolve_lang_code(lang, sentence_lang)
        cue_code = _resolve_lang_code(lang, cue_lang)

        return [
            Word(
                word_id=w["word_id"],
                original=w[target_code],
                filename=w["filename"],
                sentence=sentences.get(f"{sentence_code}_{w['word_id']}", ""),
                cue=cues.get(f"{cue_code}_{w['word_id']}", ""),
            )
            for w in rows
        ]

    def get_chapters(self, lang: LanguagePair) -> list[Chapter]:
        content = self._load_content(lang)
        return [self._to_chapter(c) for c in content.get("chapters", [])]

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
