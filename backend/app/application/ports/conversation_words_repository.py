"""Port (interface) for reading/writing a user's conversation-word usage.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import ConversationWordUsage
from backend.app.domain.value_objects import Email, LanguagePair


class ConversationWordsRepository(ABC):
    @abstractmethod
    def get_words(self, email: Email, lang: LanguagePair) -> list[ConversationWordUsage]:
        """Every tracked word for this user+lang. Empty if the user hasn't
        seeded their "<email>-<target>-progress" sheet for this pair yet."""

    @abstractmethod
    def increment_words(self, email: Email, lang: LanguagePair, word_ids: list[str]) -> None:
        """Bumps quantity by 1 for each given word_id already present in the
        sheet. A no-op for any id not found there."""
