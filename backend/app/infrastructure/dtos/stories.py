"""HTTP-boundary DTOs for the /api/stories endpoints."""
from pydantic import BaseModel

from backend.app.domain.entities import GlossaryEntry, Story, StorySummary


class StorySummaryDTO(BaseModel):
    story_id: str
    title: str
    level: str

    @classmethod
    def from_entity(cls, story: StorySummary) -> "StorySummaryDTO":
        return cls(story_id=story.story_id, title=story.title, level=story.level)


class StoriesResponse(BaseModel):
    lang: str
    stories: list[StorySummaryDTO]


class GlossaryEntryDTO(BaseModel):
    meaning: str
    examples: list[str]
    synonyms: list[str]
    antonyms: list[str]

    @classmethod
    def from_entity(cls, entry: GlossaryEntry) -> "GlossaryEntryDTO":
        return cls(
            meaning=entry.meaning,
            examples=entry.examples,
            synonyms=entry.synonyms,
            antonyms=entry.antonyms,
        )


class StoryDTO(BaseModel):
    story_id: str
    title: str
    level: str
    sentences: list[str]
    glossary: dict[str, GlossaryEntryDTO]

    @classmethod
    def from_entity(cls, story: Story) -> "StoryDTO":
        return cls(
            story_id=story.story_id,
            title=story.title,
            level=story.level,
            sentences=story.sentences,
            glossary={k: GlossaryEntryDTO.from_entity(v) for k, v in story.glossary.items()},
        )


class StoryResponse(BaseModel):
    lang: str
    story: StoryDTO
