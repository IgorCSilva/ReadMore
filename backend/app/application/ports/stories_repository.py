"""Port (interface) for reading Stories-feature content.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why. Kept separate from CatalogRepository since stories are
an independent content tree (content/<pair>/stories/<level>/<slug>/
text.json), not nested under chapters/topics.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import Story, StorySummary
from backend.app.domain.value_objects import LanguagePair


class StoriesRepository(ABC):
    @abstractmethod
    def list_stories(self, lang: LanguagePair) -> list[StorySummary]:
        """Every story for a language pair, across every level — listing
        weight only (no sentences/glossary). Empty list if the pair has no
        stories yet (not an error, same as CatalogRepository treating a
        missing optional file as empty)."""

    @abstractmethod
    def get_story(self, lang: LanguagePair, level: str, story_id: str) -> Story:
        """One full story (sentences + glossary). Raises StoryNotFoundError
        if no such level/story_id exists for this pair."""
