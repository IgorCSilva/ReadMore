"""HTTP-boundary DTOs for the /corrections endpoint."""
from pydantic import BaseModel


class CorrectionCreateRequest(BaseModel):
    chapter_number: int
    topic_number: int
    lang: str = "pt-en"
    current: list[str] = []
    correction: list[str] = []
