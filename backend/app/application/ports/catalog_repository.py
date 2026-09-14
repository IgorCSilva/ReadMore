"""Port (interface) for reading catalog content.

Lives in application/, not infrastructure/ — per RESTRUCTURE_REQUIREMENTS.md
§1, use cases depend on this abstraction, and infrastructure provides
implementations of it, never the reverse (Dependency Inversion). Grows one
method per vertical slice as later restructure steps port more endpoints.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import Word


class CatalogRepository(ABC):
    @abstractmethod
    def list_languages(self) -> list[str]:
        """All languages present in the catalog."""

    @abstractmethod
    def get_words(self, lang: str) -> list[Word]:
        """All words for a language. Raises LanguageNotFoundError if unknown."""
