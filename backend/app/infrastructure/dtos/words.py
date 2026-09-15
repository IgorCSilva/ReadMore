"""HTTP-boundary DTOs for the /words endpoint.

Domain entities never leak directly into HTTP responses (RESTRUCTURE_REQUIREMENTS.md
§1) — controllers map through these explicitly.
"""
from pydantic import BaseModel

from backend.app.domain.entities import Word


class WordDTO(BaseModel):
    word_id: str
    original: str
    filename: str
    sentence: str
    cue: str
    gender_id: str

    @classmethod
    def from_entity(cls, word: Word) -> "WordDTO":
        return cls(
            word_id=word.word_id,
            original=word.original,
            filename=word.filename,
            sentence=word.sentence,
            cue=word.cue,
            gender_id=word.gender_id,
        )


class WordsResponse(BaseModel):
    lang: str
    words: list[WordDTO]
