import json

import pytest

from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.infrastructure.repositories.json_catalog_repository import JsonCatalogRepository


def _write_catalog(tmp_path, data: dict):
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(json.dumps(data), encoding="utf-8")
    return catalog_path


def test_list_languages_reads_top_level_keys_from_catalog_file(tmp_path):
    catalog_path = _write_catalog(tmp_path, {"english": {}, "spanish": {}})

    repository = JsonCatalogRepository(catalog_path)

    assert repository.list_languages() == ["english", "spanish"]


def test_get_words_maps_catalog_entries_to_word_entities(tmp_path):
    catalog_path = _write_catalog(
        tmp_path,
        {
            "english": {
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


def test_get_words_raises_for_unknown_language(tmp_path):
    catalog_path = _write_catalog(tmp_path, {"english": {"words": []}})

    repository = JsonCatalogRepository(catalog_path)

    with pytest.raises(LanguageNotFoundError):
        repository.get_words("klingon")
