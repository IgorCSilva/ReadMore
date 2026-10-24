"""HTTP-boundary DTOs for the /chat endpoint."""
from pydantic import BaseModel


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    lang: str = "pt-en"
    level: str = "B1"
    message: str
    history: list[ChatTurn] = []


class ChatResponse(BaseModel):
    reply: str
