"""HTTP-boundary DTOs for the /data endpoint (a user's words merged with
their progress)."""
from pydantic import BaseModel

from backend.app.domain.entities import ProgressRecord, Word


class UserWordDTO(BaseModel):
    word_id: str
    original: str
    filename: str
    sentence: str
    cue: str
    gender_id: str
    confident: bool
    shown_count: int
    show: bool

    @classmethod
    def from_word_and_progress(cls, word: Word, record: ProgressRecord) -> "UserWordDTO":
        return cls(
            word_id=word.word_id,
            original=word.original,
            filename=word.filename,
            sentence=word.sentence,
            cue=word.cue,
            gender_id=word.gender_id,
            confident=record.confident,
            shown_count=record.shown_count,
            show=record.show,
        )


class UserWordsResponse(BaseModel):
    lang: str
    words: list[UserWordDTO]
