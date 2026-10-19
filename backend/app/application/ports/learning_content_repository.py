"""Port (interface) for reading the Learning-theme content tree.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why. Kept separate from StoriesRepository/CatalogRepository
since this is its own content tree (content/learning/theme/<theme>/
<chapter>_<topic>/<lang>.json), keyed by a bare target-language code rather
than an origin->target LanguagePair — there's no origin-language mixing in
this content, just plain target-language reading material.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import LearningTopic, LearningTopicSummary


class LearningContentRepository(ABC):
    @abstractmethod
    def list_topics(self, lang: str) -> list[LearningTopicSummary]:
        """Every topic across every theme that has content for this
        language code — listing weight only (no sentences). Empty list if
        none exist yet (not an error, same as StoriesRepository treating a
        missing content dir as empty)."""

    @abstractmethod
    def get_topic(self, lang: str, theme: str, topic_id: str) -> LearningTopic:
        """One full topic (sentences included). Raises
        LearningTopicNotFoundError if no such theme/topic_id has content for
        this language code."""
