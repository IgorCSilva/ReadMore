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
