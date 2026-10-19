from backend.app.application.ports.stories_repository import StoriesRepository
from backend.app.application.use_cases.list_stories import ListStories
from backend.app.domain.entities import Story, StorySummary
from backend.app.domain.value_objects import LanguagePair

PT_EN = LanguagePair(origin="pt", target="en")


class FakeStoriesRepository(StoriesRepository):
    def __init__(self, summaries: list[StorySummary]) -> None:
        self._summaries = summaries

    def list_stories(self, lang: LanguagePair) -> list[StorySummary]:
        return self._summaries

    def get_story(self, lang: LanguagePair, level: str, story_id: str) -> Story:
        raise NotImplementedError


def test_returns_summaries_from_the_repository():
    summaries = [StorySummary(story_id="muddy_feet", title="Muddy Feet", level="B1")]
    use_case = ListStories(FakeStoriesRepository(summaries))

    result = use_case.execute(PT_EN)

    assert result == summaries


def test_returns_empty_list_when_no_stories_exist():
    use_case = ListStories(FakeStoriesRepository([]))

    result = use_case.execute(PT_EN)

    assert result == []
