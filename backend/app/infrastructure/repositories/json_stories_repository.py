"""Concrete StoriesRepository implementation, reading from JSON files under
backend/content/<pair>/stories/<level>/<slug>/text.json.

Each text.json holds {id, title, level, sentences, glossary} — see
JsonCatalogRepository's module docstring for the sibling content tree this
lives next to. `sentences` is the poem/text re-segmented into one array
entry per original line (not grammatical sentence), with "" entries marking
a blank line between stanzas — both playback and the frontend's highlight
cursor skip "" entries, same as the source content.
"""
import json
from pathlib import Path

from backend.app.application.ports.stories_repository import StoriesRepository
from backend.app.domain.entities import GlossaryEntry, Story, StorySummary
from backend.app.domain.exceptions import StoryNotFoundError
from backend.app.domain.value_objects import LanguagePair


class JsonStoriesRepository(StoriesRepository):
    def __init__(self, content_dir: Path) -> None:
        self._content_dir = content_dir

    def _stories_dir(self, lang: LanguagePair) -> Path:
        return self._content_dir / str(lang) / "stories"

    def _load_json(self, path: Path) -> dict:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_stories(self, lang: LanguagePair) -> list[StorySummary]:
        stories_dir = self._stories_dir(lang)
        if not stories_dir.is_dir():
            return []
        summaries = []
        for path in sorted(stories_dir.glob("*/*/text.json")):
            data = self._load_json(path)
            summaries.append(
                StorySummary(story_id=data["id"], title=data["title"], level=data["level"])
            )
        return summaries

    def get_story(self, lang: LanguagePair, level: str, story_id: str) -> Story:
        path = self._stories_dir(lang) / level / story_id / "text.json"
        if not path.exists():
            raise StoryNotFoundError(level, story_id)
        data = self._load_json(path)
        glossary = {
            word: GlossaryEntry(
                meaning=entry["meaning"],
                examples=entry.get("examples", []),
                synonyms=entry.get("synonyms", []),
                antonyms=entry.get("antonyms", []),
            )
            for word, entry in data.get("glossary", {}).items()
        }
        return Story(
            story_id=data["id"],
            title=data["title"],
            level=data["level"],
            sentences=data.get("sentences", []),
            glossary=glossary,
        )
