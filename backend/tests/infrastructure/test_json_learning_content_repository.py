import json

import pytest

from backend.app.domain.exceptions import LearningTopicNotFoundError
from backend.app.domain.value_objects import LanguagePair
from backend.app.infrastructure.repositories.json_learning_content_repository import (
    JsonLearningContentRepository,
)

PT_ES = LanguagePair(origin="pt", target="es")


def _write_topic(content_dir, lang, theme, topic_id, data):
    topic_dir = content_dir / lang / "learning" / "theme" / theme / topic_id
    topic_dir.mkdir(parents=True, exist_ok=True)
    (topic_dir / f"{lang}.json").write_text(json.dumps(data), encoding="utf-8")


def _write_glossary(content_dir, pair, glossary):
    glossary_dir = content_dir / pair / "glossary"
    glossary_dir.mkdir(parents=True, exist_ok=True)
    (glossary_dir / "glossary.json").write_text(json.dumps(glossary), encoding="utf-8")


def test_list_topics_returns_summaries_across_themes(tmp_path):
    content_dir = tmp_path / "content"
    _write_topic(
        content_dir, "es", "health", "NUT_1",
        {"id": "NUT_1", "title": "Macronutrientes", "level": "A1", "sentences": []},
    )
    _write_topic(
        content_dir, "es", "health", "EXE_1",
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
        content_dir, "es", "health", "NUT_1",
        {"id": "NUT_1", "title": "Macronutrientes", "level": "A1", "sentences": []},
    )

    repository = JsonLearningContentRepository(content_dir)

    assert repository.list_topics("en") == []


def test_list_topics_returns_empty_list_when_no_content_dir(tmp_path):
    repository = JsonLearningContentRepository(tmp_path / "content")

    result = repository.list_topics("es")

    assert result == []


def test_get_topic_returns_sentences_and_glossary(tmp_path):
    content_dir = tmp_path / "content"
    _write_topic(
        content_dir, "es", "health", "NUT_1",
        {
            "id": "NUT_1",
            "title": "Macronutrientes",
            "level": "A1",
            "sentences": ["# Nutrición", "", "Usa el método del plato."],
        },
    )
    _write_glossary(
        content_dir, "pt-es",
        {
            "método del plato": {
                "meaning": "Uma técnica para equilibrar o prato.",
                "examples": ["Usa el método del plato."],
                "synonyms": [],
                "antonyms": [],
            },
            "vitamina": {
                "meaning": "Palavra que não aparece neste texto.",
                "examples": [],
                "synonyms": [],
                "antonyms": [],
            },
        },
    )
    repository = JsonLearningContentRepository(content_dir)

    topic = repository.get_topic(PT_ES, "health", "NUT_1")

    assert topic.topic_id == "NUT_1"
    assert topic.theme == "health"
    assert topic.title == "Macronutrientes"
    assert topic.level == "A1"
    assert topic.sentences == ["# Nutrición", "", "Usa el método del plato."]
    assert topic.glossary["método del plato"].meaning == "Uma técnica para equilibrar o prato."
    # "vitamina" is in the shared glossary but doesn't appear in this
    # topic's sentences, so it must not leak into this topic's glossary.
    assert "vitamina" not in topic.glossary


def test_get_topic_raises_not_found_for_unknown_theme_or_topic(tmp_path):
    repository = JsonLearningContentRepository(tmp_path / "content")

    with pytest.raises(LearningTopicNotFoundError):
        repository.get_topic(PT_ES, "health", "nope")
