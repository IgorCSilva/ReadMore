"""Port (interface) for text-to-speech synthesis.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why.
"""
from abc import ABC, abstractmethod


class TtsPort(ABC):
    @abstractmethod
    def synthesize(self, text: str) -> tuple[bytes, str]:
        """Returns (audio_bytes, content_type) for the given text. Raises
        TtsUpstreamError if the upstream provider fails."""
