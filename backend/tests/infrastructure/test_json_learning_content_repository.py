import json

import pytest

from backend.app.domain.exceptions import LearningTopicNotFoundError
from backend.app.infrastructure.repositories.json_learning_content_repository import (
    JsonLearningContentRepository,
)


def _write_topic(content_dir, theme, topic_id, lang, data):
    topic_dir = content_dir / "learning" / "theme" / theme / topic_id
    topic_dir.mkdir(parents=True, exist_ok=True)
    (topic_dir / f"{lang}.json").write_text(json.dumps(data), encoding="utf-8")


def test_list_topics_returns_summaries_across_themes(tmp_path):
    content_dir = tmp_path / "content"
    _write_topic(
        content_dir, "health", "NUT_1", "es",
        {"id": "NUT_1", "title": "Macronutrientes", "level": "A1", "sentences": []},
    )
    _write_topic(
        content_dir, "health", "EXE_1", "es",
        {"id": "EXE_1", "title": "Ejercicio", "level": "A1", "sentences": []},
    )
    repository = JsonLearningContentRepository(content_dir)

    result = repository.list_topics("es")

    assert {(t.topic_id, t.theme, t.title, t.level) for t in result} == {
        ("NUT_1", "health", "Macronutrientes", "A1"),
        ("EXE_1", "health", "Ejercicio", "A1"),
    }


def test_list_topics_only_matches_the_requested_language_code(tmp_path):
    content_dir = tmp_path / "content"
    _write_topic(
        content_dir, "health", "NUT_1", "es",
        {"id": "NUT_1", "title": "Macronutrientes", "level": "A1", "sentences": []},
    )

    repository = JsonLearningContentRepository(content_dir)

    assert repository.list_topics("en") == []


def test_list_topics_returns_empty_list_when_no_content_dir(tmp_path):
    repository = JsonLearningContentRepository(tmp_path / "content")

    result = repository.list_topics("es")

    assert result == []


def test_get_topic_returns_sentences(tmp_path):
    content_dir = tmp_path / "content"
    _write_topic(
        content_dir, "health", "NUT_1", "es",
        {
            "id": "NUT_1",
            "title": "Macronutrientes",
            "level": "A1",
            "sentences": ["# Nutrición", "", "Texto."],
        },
    )
    repository = JsonLearningContentRepository(content_dir)

    topic = repository.get_topic("es", "health", "NUT_1")

    assert topic.topic_id == "NUT_1"
    assert topic.theme == "health"
    assert topic.title == "Macronutrientes"
    assert topic.level == "A1"
    assert topic.sentences == ["# Nutrición", "", "Texto."]


def test_get_topic_raises_not_found_for_unknown_theme_or_topic(tmp_path):
    repository = JsonLearningContentRepository(tmp_path / "content")

    with pytest.raises(LearningTopicNotFoundError):
        repository.get_topic("es", "health", "nope")
