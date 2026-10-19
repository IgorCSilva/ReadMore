from backend.app.application.ports.learning_content_repository import LearningContentRepository
from backend.app.application.use_cases.list_learning_topics import ListLearningTopics
from backend.app.domain.entities import LearningTopic, LearningTopicSummary


class FakeLearningContentRepository(LearningContentRepository):
    def __init__(self, summaries: list[LearningTopicSummary]) -> None:
        self._summaries = summaries

    def list_topics(self, lang: str) -> list[LearningTopicSummary]:
        return self._summaries

    def get_topic(self, lang: str, theme: str, topic_id: str) -> LearningTopic:
        raise NotImplementedError


def test_returns_summaries_from_the_repository():
    summaries = [LearningTopicSummary(topic_id="NUT_1", theme="health", title="Macronutrientes", level="A1")]
    use_case = ListLearningTopics(FakeLearningContentRepository(summaries))

    result = use_case.execute("es")

    assert result == summaries


def test_returns_empty_list_when_no_topics_exist():
    use_case = ListLearningTopics(FakeLearningContentRepository([]))

    result = use_case.execute("es")

    assert result == []
