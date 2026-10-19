from backend.app.application.ports.stories_repository import StoriesRepository
from backend.app.domain.entities import Story
from backend.app.domain.value_objects import LanguagePair


class GetStory:
    def __init__(self, stories_repository: StoriesRepository) -> None:
        self._stories_repository = stories_repository

    def execute(self, lang: LanguagePair, level: str, story_id: str) -> Story:
        return self._stories_repository.get_story(lang, level, story_id)
