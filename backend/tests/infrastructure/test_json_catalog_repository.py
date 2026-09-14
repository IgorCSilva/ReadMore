import json

import pytest

from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.infrastructure.repositories.json_catalog_repository import JsonCatalogRepository


def _write_catalog(tmp_path, data: dict):
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(json.dumps(data), encoding="utf-8")
    return catalog_path


def test_list_languages_maps_pair_keys_back_to_legacy_names(tmp_path):
    # catalog.json is stored pair-keyed (Step 3.1), but list_languages()
    # still reports the legacy bare-target-language names for now — see
    # json_catalog_repository.py's module docstring for why.
    catalog_path = _write_catalog(tmp_path, {"pt-en": {}, "pt-es": {}})

    repository = JsonCatalogRepository(catalog_path)

    assert repository.list_languages() == ["english", "spanish"]


def test_list_languages_passes_through_unmapped_keys_unchanged(tmp_path):
    catalog_path = _write_catalog(tmp_path, {"fr-de": {}})

    repository = JsonCatalogRepository(catalog_path)

    assert repository.list_languages() == ["fr-de"]


def test_get_words_maps_catalog_entries_to_word_entities(tmp_path):
    catalog_path = _write_catalog(
        tmp_path,
        {
            "pt-en": {
                "words": [
                    {
                        "word_id": "en-0001",
                        "original": "hello",
                        "filename": "hello.webp",
                        "sentence": "Hello, how are you?",
                        "cue": "\U0001F44B",
                    }
                ]
            }
        },
    )

    repository = JsonCatalogRepository(catalog_path)
    words = repository.get_words("english")

    assert len(words) == 1
    assert words[0].word_id == "en-0001"
    assert words[0].original == "hello"
    assert words[0].filename == "hello.webp"
    assert words[0].sentence == "Hello, how are you?"
    assert words[0].cue == "\U0001F44B"


def test_get_words_also_accepts_the_pair_key_directly(tmp_path):
    catalog_path = _write_catalog(
        tmp_path,
        {
            "pt-en": {
                "words": [
                    {
                        "word_id": "en-0001",
                        "original": "hello",
                        "filename": "hello.webp",
                        "sentence": "Hello, how are you?",
                        "cue": "wave",
                    }
                ]
            }
        },
    )

    repository = JsonCatalogRepository(catalog_path)

    assert repository.get_words("pt-en") == repository.get_words("english")


def test_get_words_raises_for_unknown_language(tmp_path):
    catalog_path = _write_catalog(tmp_path, {"pt-en": {"words": []}})

    repository = JsonCatalogRepository(catalog_path)

    with pytest.raises(LanguageNotFoundError):
        repository.get_words("klingon")


def test_get_chapters_maps_nested_catalog_entries_to_entities(tmp_path):
    catalog_path = _write_catalog(
        tmp_path,
        {
            "pt-en": {
                "chapters": [
                    {
                        "chapter_id": "ch-01",
                        "number": 1,
                        "title": "Getting Started",
                        "description": "Intro chapter",
                        "status": "ready",
                        "topics": [
                            {
                                "topic_id": "top-01",
                                "number": 1,
                                "title": "Greetings",
                                "description": "Basic greetings",
                                "word_ids": ["en-0001"],
                                "status": "ready",
                                "texts": [
                                    {
                                        "text_id": "txt-01",
                                        "number": 1,
                                        "title": "Hello!",
                                        "body": "**Hi**!",
                                    }
                                ],
                                "exercises": [{"exercise_id": "ex-01"}],
                            }
                        ],
                    }
                ]
            }
        },
    )

    repository = JsonCatalogRepository(catalog_path)
    chapters = repository.get_chapters("english")

    assert len(chapters) == 1
    chapter = chapters[0]
    assert chapter.chapter_id == "ch-01"
    assert chapter.status == "ready"
    assert len(chapter.topics) == 1
    topic = chapter.topics[0]
    assert topic.topic_id == "top-01"
    assert topic.word_ids == ["en-0001"]
    assert topic.exercises == [{"exercise_id": "ex-01"}]
    assert len(topic.texts) == 1
    assert topic.texts[0].text_id == "txt-01"
    assert topic.texts[0].body == "**Hi**!"


def test_get_chapters_defaults_status_to_ready_when_missing(tmp_path):
    catalog_path = _write_catalog(
        tmp_path,
        {
            "pt-en": {
                "chapters": [
                    {
                        "chapter_id": "ch-01",
                        "number": 1,
                        "title": "T",
                        "description": "D",
                        "topics": [
                            {
                                "topic_id": "top-01",
                                "number": 1,
                                "title": "T",
                                "description": "D",
                                "word_ids": [],
                            }
                        ],
                    }
                ]
            }
        },
    )

    repository = JsonCatalogRepository(catalog_path)
    chapters = repository.get_chapters("english")

    assert chapters[0].status == "ready"
    assert chapters[0].topics[0].status == "ready"


def test_get_chapters_raises_for_unknown_language(tmp_path):
    catalog_path = _write_catalog(tmp_path, {"pt-en": {"chapters": []}})

    repository = JsonCatalogRepository(catalog_path)

    with pytest.raises(LanguageNotFoundError):
        repository.get_chapters("klingon")
