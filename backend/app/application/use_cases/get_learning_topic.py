from backend.app.application.ports.learning_content_repository import LearningContentRepository
from backend.app.domain.entities import LearningTopic


class GetLearningTopic:
    def __init__(self, learning_content_repository: LearningContentRepository) -> None:
        self._learning_content_repository = learning_content_repository

    def execute(self, lang: str, theme: str, topic_id: str) -> LearningTopic:
        return self._learning_content_repository.get_topic(lang, theme, topic_id)
