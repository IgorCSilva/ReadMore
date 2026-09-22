"""Concrete GameContentRepository implementation, reading from JSON files
under game_approach/content/ (see game_approach/documents/
LANGUAGE_INTEGRATION.md for why this lives outside backend/content/: it's a
new bounded context's data, not existing chapter/topic content).

One file per pair (`game-{origin}-{target}.json`), each holding every topic
that pair has an authored game area for, keyed by topic_id — mirrors
JsonCatalogRepository's per-pair content file, but scoped to game roles
instead of chapters/topics.
"""
import json
from pathlib import Path

from backend.app.application.ports.game_content_repository import GameContentRepository
from backend.app.domain.entities import GameArea, GameObject
from backend.app.domain.exceptions import GameAreaNotFoundError, LanguageNotFoundError
from backend.app.domain.value_objects import LanguagePair


class JsonGameContentRepository(GameContentRepository):
    def __init__(self, content_dir: Path) -> None:
        self._content_dir = content_dir

    def get_game_area(self, lang: LanguagePair, topic_id: str) -> GameArea:
        path = self._content_dir / f"game-{lang}.json"
        if not path.exists():
            raise LanguageNotFoundError(str(lang))

        with open(path, "r", encoding="utf-8") as f:
            topics = json.load(f)

        topic_mapping = topics.get(topic_id)
        if topic_mapping is None:
            raise GameAreaNotFoundError(topic_id)

        return GameArea(
            topic_id=topic_id,
            objects=[
                GameObject(word_id=word_id, role=entry["role"], data=entry.get("data", {}))
                for word_id, entry in topic_mapping.items()
            ],
        )
