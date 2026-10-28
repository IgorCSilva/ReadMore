"""HTTP-boundary DTOs for /conversation-words and /chat's word-tracking bit."""
from pydantic import BaseModel

from backend.app.domain.entities import ConversationWordUsage


class ConversationWordDTO(BaseModel):
    word_id: str
    word: str
    quantity: int

    @classmethod
    def from_entity(cls, usage: ConversationWordUsage) -> "ConversationWordDTO":
        return cls(word_id=usage.word_id, word=usage.word, quantity=usage.quantity)


class ConversationWordsResponse(BaseModel):
    words: list[ConversationWordDTO]
