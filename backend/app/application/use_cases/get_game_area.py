from backend.app.application.ports.game_content_repository import GameContentRepository
from backend.app.domain.entities import GameArea
from backend.app.domain.value_objects import LanguagePair


class GetGameArea:
    def __init__(self, game_content_repository: GameContentRepository) -> None:
        self._game_content_repository = game_content_repository

    def execute(self, lang: LanguagePair, topic_id: str) -> GameArea:
        return self._game_content_repository.get_game_area(lang, topic_id)
