from backend.app.application.ports.learning_content_repository import LearningContentRepository
from backend.app.domain.entities import LearningTopicSummary


class ListLearningTopics:
    def __init__(self, learning_content_repository: LearningContentRepository) -> None:
        self._learning_content_repository = learning_content_repository

    def execute(self, lang: str) -> list[LearningTopicSummary]:
        return self._learning_content_repository.list_topics(lang)
