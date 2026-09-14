"""Domain value objects — immutable, identity-free, no I/O.

See RESTRUCTURE_REQUIREMENTS.md §1 for the domain/application/infrastructure
split these belong to.
"""
import re
from dataclasses import dataclass

# Same pattern backend/server.py uses for the 'user' query/body param today.
_EMAIL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self) -> None:
        if not _EMAIL_RE.fullmatch(self.value):
            raise ValueError(f"invalid email: {self.value!r}")

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class WordId:
    value: str

    def __post_init__(self) -> None:
        if not self.value:
            raise ValueError("word_id must not be empty")

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class LanguagePair:
    """An origin→target language pair, e.g. Portuguese speaker learning English."""

    origin: str
    target: str

    def __post_init__(self) -> None:
        if not self.origin:
            raise ValueError("origin language must not be empty")
        if not self.target:
            raise ValueError("target language must not be empty")
        if self.origin == self.target:
            raise ValueError("origin and target languages must differ")

    def __str__(self) -> str:
        return f"{self.origin}-{self.target}"
