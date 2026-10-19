import pytest

from backend.app.application.ports.stories_repository import StoriesRepository
from backend.app.application.use_cases.get_story import GetStory
from backend.app.domain.entities import GlossaryEntry, Story, StorySummary
from backend.app.domain.exceptions import StoryNotFoundError
from backend.app.domain.value_objects import LanguagePair

PT_EN = LanguagePair(origin="pt", target="en")

STORY = Story(
    story_id="muddy_feet",
    title="Muddy Feet",
    level="B1",
    sentences=["Rain fell.", ""],
    glossary={"rain": GlossaryEntry(meaning="Chuva.", examples=["It rains."])},
)


class FakeStoriesRepository(StoriesRepository):
    def list_stories(self, lang: LanguagePair) -> list[StorySummary]:
        raise NotImplementedError

    def get_story(self, lang: LanguagePair, level: str, story_id: str) -> Story:
        if level == "b1" and story_id == "muddy_feet":
            return STORY
        raise StoryNotFoundError(level, story_id)


def test_returns_the_story_from_the_repository():
    use_case = GetStory(FakeStoriesRepository())

    result = use_case.execute(PT_EN, "b1", "muddy_feet")

    assert result is STORY


def test_raises_story_not_found_for_an_unknown_story():
    use_case = GetStory(FakeStoriesRepository())

    with pytest.raises(StoryNotFoundError):
        use_case.execute(PT_EN, "b1", "nope")
