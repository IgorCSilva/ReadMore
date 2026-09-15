"""Port (interface) for reading which topics are visible to a user.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why.
"""
from abc import ABC, abstractmethod

from backend.app.domain.value_objects import Email, LanguagePair


class TopicsRepository(ABC):
    @abstractmethod
    def get_enabled_topic_ids(self, email: Email, lang: LanguagePair) -> set[str]:
        """topic_ids visible to this user for this language pair."""
