"""HTTP-boundary DTOs for the /chapters endpoint."""
from pydantic import BaseModel

from backend.app.domain.entities import Chapter, Sentence, Text, Topic


class TextDTO(BaseModel):
    text_id: str
    number: int
    title: str
    body: str

    @classmethod
    def from_entity(cls, text: Text) -> "TextDTO":
        return cls(text_id=text.text_id, number=text.number, title=text.title, body=text.body)


class SentenceDTO(BaseModel):
    sentence_number: int
    content: str

    @classmethod
    def from_entity(cls, sentence: Sentence) -> "SentenceDTO":
        return cls(sentence_number=sentence.sentence_number, content=sentence.content)


class TopicDTO(BaseModel):
    """exercises always serializes as a list (defaulting to []), unlike
    backend/server.py's raw passthrough which omits the key entirely for
    catalog topics predating the Exercises feature. Confirmed harmless:
    frontend/viewer.html already reads it as `topic.exercises || []`."""

    topic_id: str
    number: int
    title: str
    description: str
    word_ids: list[str]
    texts: list[TextDTO]
    sentences: list[SentenceDTO]
    status: str
    exercises: list[dict]

    @classmethod
    def from_entity(cls, topic: Topic) -> "TopicDTO":
        return cls(
            topic_id=topic.topic_id,
            number=topic.number,
            title=topic.title,
            description=topic.description,
            word_ids=topic.word_ids,
            texts=[TextDTO.from_entity(t) for t in topic.texts],
            sentences=[SentenceDTO.from_entity(s) for s in topic.sentences],
            status=topic.status,
            exercises=topic.exercises,
        )


class ChapterDTO(BaseModel):
    chapter_id: str
    number: int
    title: str
    description: str
    topics: list[TopicDTO]
    status: str

    @classmethod
    def from_entity(cls, chapter: Chapter) -> "ChapterDTO":
        return cls(
            chapter_id=chapter.chapter_id,
            number=chapter.number,
            title=chapter.title,
            description=chapter.description,
            topics=[TopicDTO.from_entity(t) for t in chapter.topics],
            status=chapter.status,
        )


class ChaptersResponse(BaseModel):
    lang: str
    chapters: list[ChapterDTO]
