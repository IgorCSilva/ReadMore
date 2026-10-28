"""HTTP-boundary DTOs for the /chat endpoint."""
from pydantic import BaseModel

from backend.app.infrastructure.dtos.conversation_words import ConversationWordDTO


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    lang: str = "pt-en"
    level: str = "B1"
    message: str
    history: list[ChatTurn] = []
    # Optional: when given, /chat also scans `message` for the user's
    # tracked conversation words (see RecordConversationWords) and returns
    # the updated least-used list below. Omitted entirely by older/other
    # callers that don't need word tracking.
    user: str = ""


class ChatResponse(BaseModel):
    reply: str
    conversation_words: list[ConversationWordDTO] = []
