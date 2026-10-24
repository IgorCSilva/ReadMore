"""Port (interface) for free-form AI conversation practice.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why.
"""
from abc import ABC, abstractmethod


class ChatPort(ABC):
    @abstractmethod
    def send_message(
        self,
        history: list[tuple[str, str]],
        message: str,
        level: str,
        origin_lang: str,
        target_lang: str,
    ) -> str:
        """Returns the AI's reply to `message`, continuing the conversation
        in `target_lang` (a bare language code, e.g. "es") at CEFR level
        `level` (e.g. "B1"), with corrections/clarifications given in
        `origin_lang` when useful. `history` is prior (role, content) turns,
        role being "user" or "ai", oldest first. Raises ChatUpstreamError if
        the upstream provider fails."""
