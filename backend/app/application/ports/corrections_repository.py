"""Port (interface) for reading/writing user-submitted content corrections.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import Correction


class CorrectionsRepository(ABC):
    @abstractmethod
    def list_corrections(self) -> list[Correction]:
        """All corrections ever submitted, across all users/language pairs."""

    @abstractmethod
    def add_correction(
        self,
        chapter_number: int,
        topic_number: int,
        lang: str,
        current: list[str],
        correction: list[str],
    ) -> None:
        """Records a new correction report."""
