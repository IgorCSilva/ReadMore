"""Port (interface) for reading catalog content.

Lives in application/, not infrastructure/ — per RESTRUCTURE_REQUIREMENTS.md
§1, use cases depend on this abstraction, and infrastructure provides
implementations of it, never the reverse (Dependency Inversion). Grows one
method per vertical slice as later restructure steps port more endpoints.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import Chapter, Word
from backend.app.domain.value_objects import LanguagePair


class CatalogRepository(ABC):
    @abstractmethod
    def list_languages(self) -> list[LanguagePair]:
        """All language pairs present in the catalog."""

    @abstractmethod
    def get_words(
        self, lang: LanguagePair, sentence_lang: str = "target", cue_lang: str = "origin"
    ) -> list[Word]:
        """All words for a language pair. sentence_lang/cue_lang select which
        of the pair's two languages ("origin" or "target") each word's
        sentence/cue is resolved in — independently of each other, and of
        `lang` itself. Raises LanguageNotFoundError if `lang` is unknown."""

    @abstractmethod
    def get_chapters(self, lang: LanguagePair) -> list[Chapter]:
        """All chapters (with nested topics/texts) for a language pair,
        unfiltered by per-user topic visibility. Raises LanguageNotFoundError
        if unknown."""
