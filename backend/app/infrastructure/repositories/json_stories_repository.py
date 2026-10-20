"""Concrete StoriesRepository implementation, reading from JSON files under
backend/content/<target>/stories/<level>/<slug>/text.json.

Story text lives under the bare target-language directory, not the pair
directory — a story's sentences are pure target-language content with no
origin-language mixing, so pt-es and (say) en-es can share the same
backend/content/es/stories tree instead of each pair duplicating it.

Each text.json holds {id, title, level, sentences} — see
JsonCatalogRepository's module docstring for the sibling content tree this
lives next to. `sentences` is the poem/text re-segmented into one array
entry per original line (not grammatical sentence), with "" entries marking
a blank line between stanzas — both playback and the frontend's highlight
cursor skip "" entries, same as the source content.

Glossary entries are the pair-specific part (the "meaning" field is written
in the origin language) and live separately, one shared backend/content/
<pair>/glossary/glossary.json per pair, keyed by normalized word or (for
phrasal terms) a space-joined multi-word phrase — this is what avoids every
story repeating the (mostly function-word) definitions common words share.
get_story filters that shared file down to just the entries appearing in
the requested story's `sentences` via domain.glossary_words.filter_glossary,
which mirrors the frontend's tokenizeStoryWords (frontend/src/shared/
text.ts) so lookups by the Study modal's token `key` keep matching.
"""
import json
from pathlib import Path

from backend.app.application.ports.stories_repository import StoriesRepository
from backend.app.domain.entities import GlossaryEntry, Story, StorySummary
from backend.app.domain.exceptions import StoryNotFoundError
from backend.app.domain.glossary_words import filter_glossary
from backend.app.domain.value_objects import LanguagePair


class JsonStoriesRepository(StoriesRepository):
    def __init__(self, content_dir: Path) -> None:
        self._content_dir = content_dir

    def _stories_dir(self, lang: LanguagePair) -> Path:
        return self._content_dir / lang.target / "stories"

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
        return Story(
            story_id=data["id"],
            title=data["title"],
            level=data["level"],
            sentences=data.get("sentences", []),
            glossary=glossary,
        )
