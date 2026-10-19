"""HTTP-boundary DTOs for the /api/learning-topics endpoints."""
from pydantic import BaseModel

from backend.app.domain.entities import LearningTopic, LearningTopicSummary


class LearningTopicSummaryDTO(BaseModel):
    topic_id: str
    theme: str
    title: str
    level: str

    @classmethod
    def from_entity(cls, topic: LearningTopicSummary) -> "LearningTopicSummaryDTO":
        return cls(topic_id=topic.topic_id, theme=topic.theme, title=topic.title, level=topic.level)


class LearningTopicsResponse(BaseModel):
    lang: str
    topics: list[LearningTopicSummaryDTO]


class LearningTopicDTO(BaseModel):
    topic_id: str
    theme: str
    title: str
    level: str
    sentences: list[str]

    @classmethod
    def from_entity(cls, topic: LearningTopic) -> "LearningTopicDTO":
        return cls(
            topic_id=topic.topic_id,
            theme=topic.theme,
            title=topic.title,
            level=topic.level,
            sentences=topic.sentences,
        )


class LearningTopicResponse(BaseModel):
    lang: str
    topic: LearningTopicDTO
