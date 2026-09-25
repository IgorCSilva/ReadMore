"""Concrete CatalogRepository implementation, reading from JSON files under
backend/words/ and backend/content/.

As of the words-catalog redesign (see contents/language_reading_journey_phases/
readmore_adaptation/'s phase docs for the content-authoring side), catalog.json
holds only a shared, language-agnostic `words` list keyed by the stable global
word_id — one row per concept, carrying just `filename` (always an English
slug, used for image lookup, shared across every target language's spelling of
that concept). Which target languages a concept has a spelling in, and what
that spelling is, lives in backend/words/<target>_words.json instead — one row
per (target language, concept) pair: `{word_id: "<target>-wd-NNNN" (sequential
per language), root_word_id: "<catalog word_id>", word: "<spelling>"}`.
`root_word_id` is the join key back to catalog.json and is never renumbered or
reused, same stability guarantee as catalog.json's own word_id. Everything
pair-specific lives elsewhere: content/<pair>.json (chapters/topics/texts/
exercises — topics' word_ids use the same per-target-language ids, resolved
back to root_word_id by get_chapters below), sentences.json and cues.json
(flat, keyed by "<lang-code>_<root_word_id>" — lang-code is either the pair's
origin or target code, letting the same root_word_id resolve either variant).
"""
import json
from pathlib import Path

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.domain.entities import Chapter, Phrase, Sentence, Text, Topic, Word
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

    def _load_lang_words(self, target_code: str) -> list[dict]:
        """Rows from backend/words/<target>_words.json: {word_id, root_word_id,
        word}, one per concept this target language has a spelling for.
        Missing file (no words authored for this target language yet) is not
        an error — resolves to no words, same as an empty list would."""
        path = self._catalog_path.parent / f"{target_code}_words.json"
        if not path.exists():
            return []
        return self._load_json(path)

    def _load_phrases(self, target_code: str) -> dict:
        """chapter_N -> topic_N -> [{id, sentence, word_ids}], from
        content/<target>_sentences.json (e.g. es_sentences.json) — standalone
        natural target-language sentences for the reinforcement "listen and
        pick the known words" tab. Missing file (no phrases authored for this
        target yet) is not an error, same as _load_lang_words above."""
        path = self._content_dir / f"{target_code}_sentences.json"
        if not path.exists():
            return {}
        return self._load_json(path)

    def _load_word_map(self, target_code: str) -> dict[str, str]:
        """Per-target-language friendly id -> catalog root_word_id (e.g.
        "es-wd-0001" -> "wd-0001"). Lets content/<pair>.json's topics.word_ids
        read as a clean sequence per language while every other consumer
        (frontend, exercises, Sheets-backed progress) keeps resolving on
        catalog.json's stable global word_id, unchanged."""
        return {row["word_id"]: row["root_word_id"] for row in self._load_lang_words(target_code)}

    def list_languages(self) -> list[LanguagePair]:
        # content_dir also holds per-language word lists (e.g. es.json, used by
        # the words-adaptation phase to author a target's vocabulary before
        # it's adapted into a pair) alongside actual "<origin>-<target>.json"
        # pair files — skip anything whose stem doesn't parse as a pair rather
        # than assuming every *.json here is one.
        pairs = []
        for path in sorted(self._content_dir.glob("*.json")):
            try:
                pairs.append(LanguagePair.parse(path.stem))
            except ValueError:
                continue
        return pairs

    def get_words(
        self, lang: LanguagePair, sentence_lang: str = "target", cue_lang: str = "origin"
    ) -> list[Word]:
        pair_key = str(lang)
        # backend/words/<target>_words.json is the source of which concepts
        # this target language has a spelling for, and what it is — origin is
        # dropped since, for this app so far, one target language never
        # appears under two different origins.
        lang_words = self._load_lang_words(lang.target)
        if not lang_words and not (self._content_dir / f"{pair_key}.json").exists():
            raise LanguageNotFoundError(pair_key)

        catalog_by_id = {w["word_id"]: w for w in self._load_words()}
        sentences = self._load_json(self._sentences_path)
        cues = self._load_json(self._cues_path)
        sentence_code = _resolve_lang_code(lang, sentence_lang)
        cue_code = _resolve_lang_code(lang, cue_lang)

        return [
            Word(
                word_id=row["root_word_id"],
                original=row["word"],
                filename=catalog_by_id[row["root_word_id"]]["filename"],
                sentence=sentences.get(f"{sentence_code}_{row['root_word_id']}", ""),
                cue=cues.get(f"{cue_code}_{row['root_word_id']}", ""),
                gender_id=row.get("gender_id", "not_apply"),
                particle_type=row.get("particle_type", "not_apply"),
            )
            for row in lang_words
        ]

    def get_chapters(self, lang: LanguagePair) -> list[Chapter]:
        content = self._load_content(lang)
        word_map = self._load_word_map(lang.target)
        phrases_by_chapter = self._load_phrases(lang.target)
        return [self._to_chapter(c, word_map, phrases_by_chapter) for c in content.get("chapters", [])]

    @staticmethod
    def _to_chapter(data: dict, word_map: dict[str, str], phrases_by_chapter: dict) -> Chapter:
        chapter_phrases = phrases_by_chapter.get(f"chapter_{data['number']}", {})
        return Chapter(
            chapter_id=data["chapter_id"],
            number=data["number"],
            title=data["title"],
            description=data["description"],
            topics=[
                JsonCatalogRepository._to_topic(t, word_map, chapter_phrases)
                for t in data.get("topics", [])
            ],
            status=data.get("status", "ready"),
        )

    @staticmethod
    def _to_topic(data: dict, word_map: dict[str, str], chapter_phrases: dict) -> Topic:
        return Topic(
            topic_id=data["topic_id"],
            number=data["number"],
            title=data["title"],
            description=data["description"],
            word_ids=[word_map.get(w, w) for w in data.get("word_ids", [])],
            texts=[JsonCatalogRepository._to_text(t) for t in data.get("texts", [])],
            sentences=[JsonCatalogRepository._to_sentence(s) for s in data.get("sentences", [])],
            phrases=[
                JsonCatalogRepository._to_phrase(p, word_map)
                for p in chapter_phrases.get(f"topic_{data['number']}", [])
            ],
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

    @staticmethod
    def _to_sentence(data: dict) -> Sentence:
        return Sentence(
            sentence_number=data["sentence_number"],
            content=data["content"],
        )

    @staticmethod
    def _to_phrase(data: dict, word_map: dict[str, str]) -> Phrase:
        return Phrase(
            id=data["id"],
            sentence=data["sentence"],
            word_ids=[word_map.get(w, w) for w in data.get("word_ids", [])],
        )
