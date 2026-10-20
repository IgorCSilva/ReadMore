import pytest

from backend.app.application.ports.learning_content_repository import LearningContentRepository
from backend.app.application.use_cases.get_learning_topic import GetLearningTopic
from backend.app.domain.entities import LearningTopic, LearningTopicSummary
from backend.app.domain.exceptions import LearningTopicNotFoundError
from backend.app.domain.value_objects import LanguagePair

PT_ES = LanguagePair(origin="pt", target="es")

TOPIC = LearningTopic(
    topic_id="NUT_1", theme="health", title="Macronutrientes", level="A1", sentences=["Texto.", ""]
)


class FakeLearningContentRepository(LearningContentRepository):
    def list_topics(self, lang: str) -> list[LearningTopicSummary]:
        raise NotImplementedError

    def get_topic(self, lang: LanguagePair, theme: str, topic_id: str) -> LearningTopic:
        if theme == "health" and topic_id == "NUT_1":
            return TOPIC
        raise LearningTopicNotFoundError(theme, topic_id)


def test_returns_the_topic_from_the_repository():
    use_case = GetLearningTopic(FakeLearningContentRepository())

    result = use_case.execute(PT_ES, "health", "NUT_1")

    assert result is TOPIC


def test_raises_not_found_for_an_unknown_topic():
    use_case = GetLearningTopic(FakeLearningContentRepository())

    with pytest.raises(LearningTopicNotFoundError):
        use_case.execute(PT_ES, "health", "nope")
