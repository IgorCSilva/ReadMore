"""HTTP-boundary DTOs for the /game-area endpoint.

Domain entities never leak directly into HTTP responses (RESTRUCTURE_REQUIREMENTS.md
§1) — controllers map through these explicitly.
"""
from pydantic import BaseModel

from backend.app.domain.entities import GameArea, GameObject


class GameObjectDTO(BaseModel):
    word_id: str
    role: str
    data: dict

    @classmethod
    def from_entity(cls, obj: GameObject) -> "GameObjectDTO":
        return cls(word_id=obj.word_id, role=obj.role, data=obj.data)


class GameAreaResponse(BaseModel):
    lang: str
    topic_id: str
    objects: list[GameObjectDTO]

    @classmethod
    def from_entity(cls, lang: str, area: GameArea) -> "GameAreaResponse":
        return cls(
            lang=lang,
            topic_id=area.topic_id,
            objects=[GameObjectDTO.from_entity(o) for o in area.objects],
        )
