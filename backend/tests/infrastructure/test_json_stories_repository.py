import json

import pytest

from backend.app.domain.exceptions import StoryNotFoundError
from backend.app.domain.value_objects import LanguagePair
from backend.app.infrastructure.repositories.json_stories_repository import JsonStoriesRepository

PT_EN = LanguagePair(origin="pt", target="en")


def _write_story(content_dir, target, level, story_id, data):
    story_dir = content_dir / target / "stories" / level / story_id
    story_dir.mkdir(parents=True, exist_ok=True)
    (story_dir / "text.json").write_text(json.dumps(data), encoding="utf-8")


def _write_glossary(content_dir, pair, glossary):
    glossary_dir = content_dir / pair / "glossary"
    glossary_dir.mkdir(parents=True, exist_ok=True)
    (glossary_dir / "glossary.json").write_text(json.dumps(glossary), encoding="utf-8")


def test_list_stories_returns_summaries_across_levels(tmp_path):
    content_dir = tmp_path / "content"
    _write_story(
        content_dir, "en", "b1", "muddy_feet",
        {"id": "muddy_feet", "title": "Muddy Feet", "level": "B1", "sentences": []},
    )
    _write_story(
        content_dir, "en", "a1", "simple_day",
        {"id": "simple_day", "title": "A Simple Day", "level": "A1", "sentences": []},
    )
    repository = JsonStoriesRepository(content_dir)

    result = repository.list_stories(PT_EN)

    assert {(s.story_id, s.title, s.level) for s in result} == {
        ("muddy_feet", "Muddy Feet", "B1"),
        ("simple_day", "A Simple Day", "A1"),
    }


def test_list_stories_returns_empty_list_when_pair_has_no_stories_dir(tmp_path):
    repository = JsonStoriesRepository(tmp_path / "content")

    result = repository.list_stories(PT_EN)

    assert result == []


def test_get_story_returns_sentences_and_glossary(tmp_path):
    content_dir = tmp_path / "content"
    _write_story(
        content_dir, "en", "b1", "muddy_feet",
        {
            "id": "muddy_feet",
            "title": "Muddy Feet",
            "level": "B1",
            "sentences": ["Rain fell.", ""],
        },
    )
    _write_glossary(
        content_dir, "pt-en",
        {
            "rain": {
                "meaning": "Chuva.",
                "examples": ["It rains."],
                "synonyms": ["shower"],
                "antonyms": ["drought"],
            },
            "sun": {
                "meaning": "Sol.",
                "examples": ["The sun shines."],
                "synonyms": [],
                "antonyms": [],
            },
        },
    )
    repository = JsonStoriesRepository(content_dir)

    story = repository.get_story(PT_EN, "b1", "muddy_feet")

    assert story.story_id == "muddy_feet"
    assert story.title == "Muddy Feet"
    assert story.level == "B1"
    assert story.sentences == ["Rain fell.", ""]
    assert story.glossary["rain"].meaning == "Chuva."
    assert story.glossary["rain"].examples == ["It rains."]
    assert story.glossary["rain"].synonyms == ["shower"]
    assert story.glossary["rain"].antonyms == ["drought"]
    # "sun" is in the shared glossary but doesn't appear in this story's
    # sentences, so it must not leak into this story's glossary.
    assert "sun" not in story.glossary


def test_get_story_raises_story_not_found_for_unknown_level_or_slug(tmp_path):
    repository = JsonStoriesRepository(tmp_path / "content")

    with pytest.raises(StoryNotFoundError):
        repository.get_story(PT_EN, "b1", "nope")
