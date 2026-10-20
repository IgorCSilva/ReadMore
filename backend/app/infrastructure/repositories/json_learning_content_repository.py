"""Concrete LearningContentRepository implementation, reading from JSON files
under backend/content/<target>/learning/theme/<theme>/<chapter>_<topic>/
<lang>.json.

Topic content lives under the bare target-language directory, same
reasoning as JsonStoriesRepository's move: it's pure target-language
content with no origin-language mixing, so multiple origin pairs could
share the same backend/content/<target>/learning tree.

Each <lang>.json holds {id, title, level, sentences}. `sentences` is the
source Markdown file re-segmented one array entry per original line, with
"" entries marking a blank line between blocks — same convention
JsonStoriesRepository uses for stanza breaks, so the frontend reader can
reuse the same blank-line handling.

Glossary entries are the pair-specific part (the "meaning" field is written
in the origin language) and live separately, one shared backend/content/
<pair>/glossary/glossary.json per pair — same file Stories' glossary lives
in, since both features' Study modal draw from the same pair vocabulary.
get_topic filters that shared file down to just the entries appearing in
the requested topic's `sentences` via domain.glossary_words.filter_glossary.
"""
import json
from pathlib import Path

from backend.app.application.ports.learning_content_repository import LearningContentRepository
from backend.app.domain.entities import GlossaryEntry, LearningTopic, LearningTopicSummary
from backend.app.domain.exceptions import LearningTopicNotFoundError
from backend.app.domain.glossary_words import filter_glossary
from backend.app.domain.value_objects import LanguagePair


class JsonLearningContentRepository(LearningContentRepository):
    def __init__(self, content_dir: Path) -> None:
        self._content_dir = content_dir

    def _themes_dir(self, target: str) -> Path:
        return self._content_dir / target / "learning" / "theme"

    def _glossary_path(self, lang: LanguagePair) -> Path:
        return self._content_dir / str(lang) / "glossary" / "glossary.json"

    def _load_json(self, path: Path) -> dict:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _load_glossary(self, lang: LanguagePair) -> dict:
        path = self._glossary_path(lang)
        if not path.exists():
            return {}
        return self._load_json(path)

    def list_topics(self, lang: str) -> list[LearningTopicSummary]:
        themes_dir = self._themes_dir(lang)
        if not themes_dir.is_dir():
            return []
        summaries = []
        for path in sorted(themes_dir.glob(f"*/*/{lang}.json")):
            theme = path.parent.parent.name
            data = self._load_json(path)
            summaries.append(
                LearningTopicSummary(
                    topic_id=data["id"], theme=theme, title=data["title"], level=data["level"]
                )
            )
        return summaries

    def get_topic(self, lang: LanguagePair, theme: str, topic_id: str) -> LearningTopic:
        path = self._themes_dir(lang.target) / theme / topic_id / f"{lang.target}.json"
        if not path.exists():
            raise LearningTopicNotFoundError(theme, topic_id)
        data = self._load_json(path)
        sentences = data.get("sentences", [])
        shared_glossary = self._load_glossary(lang)
        glossary = {
            word: GlossaryEntry(
                meaning=entry["meaning"],
                examples=entry.get("examples", []),
                synonyms=entry.get("synonyms", []),
                antonyms=entry.get("antonyms", []),
            )
            for word, entry in filter_glossary(shared_glossary, sentences).items()
        }
        return LearningTopic(
            topic_id=data["id"],
            theme=theme,
            title=data["title"],
            level=data["level"],
            sentences=sentences,
            glossary=glossary,
        )
