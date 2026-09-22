import json

import pytest

from backend.app.domain.exceptions import GameAreaNotFoundError, LanguageNotFoundError
from backend.app.domain.value_objects import LanguagePair
from backend.app.infrastructure.repositories.json_game_content_repository import (
    JsonGameContentRepository,
)

PT_ES = LanguagePair(origin="pt", target="es")


def _repository(tmp_path, pairs: dict[str, dict] | None = None) -> JsonGameContentRepository:
    content_dir = tmp_path / "game-content"
    content_dir.mkdir()
    for pair, data in (pairs or {}).items():
        (content_dir / f"game-{pair}.json").write_text(json.dumps(data), encoding="utf-8")
    return JsonGameContentRepository(content_dir)


def test_get_game_area_maps_mapping_entries_to_game_objects(tmp_path):
    repository = _repository(
        tmp_path,
        pairs={
            "pt-es": {
                "top-A0-EL-1": {
                    "es-wd-0001": {"role": "dialogue", "data": {"line": "greeting-formal"}},
                    "es-wd-0018": {"role": "noun", "data": {"concept": "self"}},
                }
            }
        },
    )

    area = repository.get_game_area(PT_ES, "top-A0-EL-1")

    assert area.topic_id == "top-A0-EL-1"
    assert len(area.objects) == 2
    dialogue_obj = next(o for o in area.objects if o.word_id == "es-wd-0001")
    assert dialogue_obj.role == "dialogue"
    assert dialogue_obj.data == {"line": "greeting-formal"}
    noun_obj = next(o for o in area.objects if o.word_id == "es-wd-0018")
    assert noun_obj.role == "noun"
    assert noun_obj.data == {"concept": "self"}


def test_get_game_area_defaults_data_to_empty_dict_when_absent(tmp_path):
    repository = _repository(
        tmp_path,
        pairs={"pt-es": {"top-A0-EL-1": {"es-wd-0001": {"role": "dialogue"}}}},
    )

    area = repository.get_game_area(PT_ES, "top-A0-EL-1")

    assert area.objects[0].data == {}


def test_raises_language_not_found_when_pair_file_is_missing(tmp_path):
    repository = _repository(tmp_path)

    with pytest.raises(LanguageNotFoundError):
        repository.get_game_area(PT_ES, "top-A0-EL-1")


def test_raises_game_area_not_found_when_topic_has_no_mapping(tmp_path):
    repository = _repository(tmp_path, pairs={"pt-es": {"top-A0-EL-2": {}}})

    with pytest.raises(GameAreaNotFoundError):
        repository.get_game_area(PT_ES, "top-A0-EL-1")
