"""Port (interface) for reading the Learning-theme content tree.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why. Kept separate from StoriesRepository/CatalogRepository
since this is its own content tree (content/<target>/learning/theme/<theme>/
<chapter>_<topic>/<lang>.json) — plain target-language reading material, no
origin-language mixing in the content itself, so list_topics (listing
weight, no glossary needed) still only takes a bare target-language code.
get_topic takes a full LanguagePair instead, the same as StoriesRepository,
because its glossary overlay (see Story.glossary) is pair-specific — its
"meaning" text is written in the origin language.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import LearningTopic, LearningTopicSummary
from backend.app.domain.value_objects import LanguagePair


class LearningContentRepository(ABC):
    @abstractmethod
    def list_topics(self, lang: str) -> list[LearningTopicSummary]:
        """Every topic across every theme that has content for this
        language code — listing weight only (no sentences). Empty list if
        none exist yet (not an error, same as StoriesRepository treating a
        missing content dir as empty)."""

    @abstractmethod
    def get_topic(self, lang: LanguagePair, theme: str, topic_id: str) -> LearningTopic:
        """One full topic (sentences + glossary). Raises
        LearningTopicNotFoundError if no such theme/topic_id has content for
        this pair's target language."""
