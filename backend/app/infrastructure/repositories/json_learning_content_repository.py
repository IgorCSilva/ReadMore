"""Concrete LearningContentRepository implementation, reading from JSON files
under backend/content/learning/theme/<theme>/<chapter>_<topic>/<lang>.json.

Each <lang>.json holds {id, title, level, sentences} — no glossary (unlike
Stories' text.json), since this is plain informational reading rather than a
vocabulary-study text. `sentences` is the source Markdown file re-segmented
one array entry per original line, with "" entries marking a blank line
between blocks — same convention JsonStoriesRepository uses for stanza
breaks, so the frontend reader can reuse the same blank-line handling.
"""
import json
from pathlib import Path

from backend.app.application.ports.learning_content_repository import LearningContentRepository
from backend.app.domain.entities import LearningTopic, LearningTopicSummary
from backend.app.domain.exceptions import LearningTopicNotFoundError


class JsonLearningContentRepository(LearningContentRepository):
    def __init__(self, content_dir: Path) -> None:
        self._themes_dir = content_dir / "learning" / "theme"

    def _load_json(self, path: Path) -> dict:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_topics(self, lang: str) -> list[LearningTopicSummary]:
        if not self._themes_dir.is_dir():
            return []
        summaries = []
        for path in sorted(self._themes_dir.glob(f"*/*/{lang}.json")):
            theme = path.parent.parent.name
            data = self._load_json(path)
            summaries.append(
                LearningTopicSummary(
                    topic_id=data["id"], theme=theme, title=data["title"], level=data["level"]
                )
            )
        return summaries

    def get_topic(self, lang: str, theme: str, topic_id: str) -> LearningTopic:
        path = self._themes_dir / theme / topic_id / f"{lang}.json"
        if not path.exists():
            raise LearningTopicNotFoundError(theme, topic_id)
        data = self._load_json(path)
        return LearningTopic(
            topic_id=data["id"],
            theme=theme,
            title=data["title"],
            level=data["level"],
            sentences=data.get("sentences", []),
        )
