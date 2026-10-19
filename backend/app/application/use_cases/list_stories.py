from backend.app.application.ports.stories_repository import StoriesRepository
from backend.app.domain.entities import StorySummary
from backend.app.domain.value_objects import LanguagePair


class ListStories:
    def __init__(self, stories_repository: StoriesRepository) -> None:
        self._stories_repository = stories_repository

    def execute(self, lang: LanguagePair) -> list[StorySummary]:
        return self._stories_repository.list_stories(lang)
