"""Port (interface) for reading/writing per-user word progress.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import ProgressRecord
from backend.app.domain.value_objects import Email, LanguagePair


class ProgressRepository(ABC):
    @abstractmethod
    def get_user_progress(self, email: Email, lang: LanguagePair) -> dict[str, ProgressRecord]:
        """Progress records for this user+lang, keyed by word_id. A brand-new
        user, or a word not assigned to this user, simply has no entry."""

    @abstractmethod
    def upsert_progress(self, email: Email, lang: LanguagePair, record: ProgressRecord) -> None:
        """Persist record's confident/shown_count/show for this user+lang+word_id."""
