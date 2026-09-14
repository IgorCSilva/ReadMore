"""HTTP-boundary DTOs for /increment, /mark-known, /show-word."""
from pydantic import BaseModel


class ProgressActionRequest(BaseModel):
    user: str = ""
    lang: str = "english"
    word_id: str | None = None
