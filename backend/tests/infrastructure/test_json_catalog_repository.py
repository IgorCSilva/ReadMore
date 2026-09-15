import json

import pytest

from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import LanguagePair
from backend.app.infrastructure.repositories.json_catalog_repository import JsonCatalogRepository

PT_EN = LanguagePair(origin="pt", target="en")


def _write_json(path, data: dict):
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def _repository(
    tmp_path,
    words: list[dict] | None = None,
    content: dict[str, dict] | None = None,
    sentences: dict[str, str] | None = None,
    cues: dict[str, str] | None = None,
) -> JsonCatalogRepository:
    words_dir = tmp_path / "words"
    words_dir.mkdir()
    catalog_path = _write_json(words_dir / "catalog.json", {"words": words or []})
    content_dir = tmp_path / "content"
    content_dir.mkdir()
    for pair, data in (content or {}).items():
        _write_json(content_dir / f"{pair}.json", data)
    sentences_path = _write_json(words_dir / "sentences.json", sentences or {})
    cues_path = _write_json(words_dir / "cues.json", cues or {})
    return JsonCatalogRepository(catalog_path, content_dir, sentences_path, cues_path)


def test_list_languages_parses_content_dir_filenames_as_pairs(tmp_path):
    repository = _repository(tmp_path, content={"pt-en": {"chapters": []}, "pt-es": {"chapters": []}})

    assert repository.list_languages() == [
        LanguagePair(origin="pt", target="en"),
        LanguagePair(origin="pt", target="es"),
    ]


def test_get_words_maps_catalog_entries_to_word_entities(tmp_path):
    repository = _repository(
        tmp_path,
        # catalog rows key their spelling by target-language code alone
        # ("en"), not the full pair ("pt-en") — origin doesn't matter here.
        words=[{"word_id": "wd-0001", "filename": "hello.webp", "en": "hello"}],
        content={"pt-en": {"chapters": []}},
        sentences={"en_wd-0001": "Hello, how are you?", "pt_wd-0001": "Olá, como você está?"},
        cues={"pt_wd-0001": "\U0001F44B", "en_wd-0001": "wave"},
    )

    words = repository.get_words(PT_EN)

    assert len(words) == 1
    word = words[0]
    assert word.word_id == "wd-0001"
    assert word.original == "hello"
    assert word.filename == "hello.webp"
    # defaults: sentence resolved in the target language, cue in the origin language
    assert word.sentence == "Hello, how are you?"
    assert word.cue == "\U0001F44B"


def test_get_words_only_returns_rows_that_carry_the_requested_targets_code(tmp_path):
    repository = _repository(
        tmp_path,
        words=[
            {"word_id": "wd-0001", "filename": "hello.webp", "en": "hello", "es": "hola"},
            {"word_id": "wd-0002", "filename": "bye.webp", "es": "adiós"},
        ],
        content={"pt-en": {"chapters": []}},
    )

    words = repository.get_words(PT_EN)

    assert [w.word_id for w in words] == ["wd-0001"]


def test_get_words_sentence_lang_and_cue_lang_select_the_variant(tmp_path):
    repository = _repository(
        tmp_path,
        words=[{"word_id": "wd-0001", "filename": "hello.webp", "en": "hello"}],
        content={"pt-en": {"chapters": []}},
        sentences={"en_wd-0001": "Hello, how are you?", "pt_wd-0001": "Olá, como você está?"},
        cues={"pt_wd-0001": "Uma saudação.", "en_wd-0001": "A greeting."},
    )

    origin_sentence_target_cue = repository.get_words(PT_EN, sentence_lang="origin", cue_lang="target")[0]
    assert origin_sentence_target_cue.sentence == "Olá, como você está?"
    assert origin_sentence_target_cue.cue == "A greeting."

    target_sentence_origin_cue = repository.get_words(PT_EN, sentence_lang="target", cue_lang="origin")[0]
    assert target_sentence_origin_cue.sentence == "Hello, how are you?"
    assert target_sentence_origin_cue.cue == "Uma saudação."


def test_get_words_falls_back_to_empty_string_when_a_variant_is_not_yet_authored(tmp_path):
    repository = _repository(
        tmp_path,
        words=[{"word_id": "wd-0001", "filename": "hello.webp", "en": "hello"}],
        content={"pt-en": {"chapters": []}},
        sentences={"en_wd-0001": "Hello, how are you?"},
        cues={"pt_wd-0001": "Uma saudação."},
    )

    word = repository.get_words(PT_EN, sentence_lang="origin", cue_lang="target")[0]

    assert word.sentence == ""
    assert word.cue == ""


def test_get_words_raises_for_unknown_language(tmp_path):
    repository = _repository(tmp_path, words=[], content={"pt-en": {"chapters": []}})

    with pytest.raises(LanguageNotFoundError):
        repository.get_words(LanguagePair(origin="xx", target="yy"))


def test_get_words_returns_empty_list_for_a_known_pair_with_no_words_yet(tmp_path):
    repository = _repository(tmp_path, words=[], content={"pt-en": {"chapters": []}, "pt-es": {"chapters": []}})

    assert repository.get_words(LanguagePair(origin="pt", target="es")) == []


def test_get_chapters_maps_nested_content_entries_to_entities(tmp_path):
    repository = _repository(
        tmp_path,
        content={
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
                                "word_ids": ["wd-0001"],
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

    chapters = repository.get_chapters(PT_EN)

    assert len(chapters) == 1
    chapter = chapters[0]
    assert chapter.chapter_id == "ch-01"
    assert chapter.status == "ready"
    assert len(chapter.topics) == 1
    topic = chapter.topics[0]
    assert topic.topic_id == "top-01"
    assert topic.word_ids == ["wd-0001"]
    assert topic.exercises == [{"exercise_id": "ex-01"}]
    assert len(topic.texts) == 1
    assert topic.texts[0].text_id == "txt-01"
    assert topic.texts[0].body == "**Hi**!"


def test_get_chapters_defaults_status_to_ready_when_missing(tmp_path):
    repository = _repository(
        tmp_path,
        content={
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

    chapters = repository.get_chapters(PT_EN)

    assert chapters[0].status == "ready"
    assert chapters[0].topics[0].status == "ready"


def test_get_chapters_raises_for_unknown_language(tmp_path):
    repository = _repository(tmp_path, content={"pt-en": {"chapters": []}})

    with pytest.raises(LanguageNotFoundError):
        repository.get_chapters(LanguagePair(origin="xx", target="yy"))
