"""Port (interface) for reading/writing per-user authoritative game state.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why. See game_approach/documents/MULTIPLAYER_ARCHITECTURE.md for
why this state (as opposed to local/client state) must be persisted here
rather than held only in the Phaser scene.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import PlayerGameState
from backend.app.domain.value_objects import Email, LanguagePair


class GameStateRepository(ABC):
    @abstractmethod
    def get_player_state(
        self, email: Email, lang: LanguagePair, topic_id: str
    ) -> PlayerGameState | None:
        """This player's saved state for this lang+topic, or None if they
        haven't started it yet — callers construct a fresh PlayerGameState
        for that case rather than this method inventing default values."""

    @abstractmethod
    def save_player_state(
        self, email: Email, lang: LanguagePair, state: PlayerGameState
    ) -> None:
        """Persist state for this user+lang, keyed by state.topic_id."""
