"""Port (interface) for reading a topic's game-content mapping.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why. See game_approach/documents/LANGUAGE_INTEGRATION.md for the
mapping file shape this reads and the cross-pair constraint it must honor.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import GameArea
from backend.app.domain.value_objects import LanguagePair


class GameContentRepository(ABC):
    @abstractmethod
    def get_game_area(self, lang: LanguagePair, topic_id: str) -> GameArea:
        """The game-content mapping for topic_id under this language pair,
        as a GameArea. Raises LanguageNotFoundError if lang is unknown, or
        GameAreaNotFoundError if topic_id has no mapping yet (mapping files
        are authored per topic, so this is expected for any topic the game
        hasn't reached)."""
