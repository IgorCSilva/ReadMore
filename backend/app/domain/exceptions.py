"""Domain-level exceptions — meaningful business errors, independent of HTTP.

Infrastructure controllers translate these into the appropriate HTTP
response; use cases and repositories only ever raise/see this vocabulary.
"""


class LanguageNotFoundError(Exception):
    def __init__(self, lang: str) -> None:
        self.lang = lang
        super().__init__(f"unknown language: {lang}")


class WordNotAssignedError(Exception):
    def __init__(self, word_id: str) -> None:
        self.word_id = word_id
        super().__init__(f"word not assigned to user: {word_id}")


class TtsUpstreamError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(f"TTS upstream failed: {detail}")


class InvalidCorrectionError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(f"invalid correction: {detail}")


class GameAreaNotFoundError(Exception):
    def __init__(self, topic_id: str) -> None:
        self.topic_id = topic_id
        super().__init__(f"no game-content mapping for topic: {topic_id}")
