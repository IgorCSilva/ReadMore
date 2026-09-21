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
    word_maps: dict[str, list[dict]] | None = None,
    phrases: dict[str, dict] | None = None,
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
    for target_code, rows in (word_maps or {}).items():
        _write_json(words_dir / f"{target_code}_words.json", rows)
    for target_code, data in (phrases or {}).items():
        _write_json(content_dir / f"{target_code}_sentences.json", data)
    return JsonCatalogRepository(catalog_path, content_dir, sentences_path, cues_path)


def test_list_languages_parses_content_dir_filenames_as_pairs(tmp_path):
    repository = _repository(tmp_path, content={"pt-en": {"chapters": []}, "pt-es": {"chapters": []}})

    assert repository.list_languages() == [
        LanguagePair(origin="pt", target="en"),
        LanguagePair(origin="pt", target="es"),
    ]


def test_list_languages_skips_non_pair_files_in_content_dir(tmp_path):
    # content_dir also holds per-language word lists (es.json, pt.json, ...)
    # used by the words-adaptation phase — these have no hyphen in the stem
    # and must not be mistaken for a "<origin>-<target>.json" pair file.
    repository = _repository(
        tmp_path,
        content={"pt-en": {"chapters": []}, "es": {"chapter_1": {"topic_1": []}}},
    )

    assert repository.list_languages() == [LanguagePair(origin="pt", target="en")]


def test_get_words_maps_catalog_entries_to_word_entities(tmp_path):
    repository = _repository(
        tmp_path,
        # catalog.json is language-agnostic: word_id + filename only. Which
        # target languages a concept has a spelling in, and what it is, comes
        # from <target>_words.json instead — origin doesn't matter here.
        words=[{"word_id": "wd-0001", "filename": "hello.webp"}],
        content={"pt-en": {"chapters": []}},
        sentences={"en_wd-0001": "Hello, how are you?", "pt_wd-0001": "Olá, como você está?"},
        cues={"pt_wd-0001": "\U0001F44B", "en_wd-0001": "wave"},
        word_maps={"en": [{"word_id": "en-wd-0001", "root_word_id": "wd-0001", "word": "hello"}]},
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


def test_get_words_maps_gender_id_and_defaults_to_not_apply_when_missing(tmp_path):
    repository = _repository(
        tmp_path,
        words=[
            {"word_id": "wd-0001", "filename": "father.webp"},
            {"word_id": "wd-0002", "filename": "hello.webp"},
        ],
        content={"pt-en": {"chapters": []}},
        word_maps={
            "en": [
                {"word_id": "en-wd-0001", "root_word_id": "wd-0001", "word": "father", "gender_id": "masculine"},
                {"word_id": "en-wd-0002", "root_word_id": "wd-0002", "word": "hello"},
            ]
        },
    )

    words = repository.get_words(PT_EN)

    assert words[0].gender_id == "masculine"
    assert words[1].gender_id == "not_apply"


def test_get_words_only_returns_concepts_the_requested_target_language_has_a_spelling_for(tmp_path):
    repository = _repository(
        tmp_path,
        words=[
            {"word_id": "wd-0001", "filename": "hello.webp"},
            {"word_id": "wd-0002", "filename": "bye.webp"},
        ],
        content={"pt-en": {"chapters": []}},
        word_maps={"en": [{"word_id": "en-wd-0001", "root_word_id": "wd-0001", "word": "hello"}]},
    )

    words = repository.get_words(PT_EN)

    assert [w.word_id for w in words] == ["wd-0001"]


def test_get_words_sentence_lang_and_cue_lang_select_the_variant(tmp_path):
    repository = _repository(
        tmp_path,
        words=[{"word_id": "wd-0001", "filename": "hello.webp"}],
        content={"pt-en": {"chapters": []}},
        sentences={"en_wd-0001": "Hello, how are you?", "pt_wd-0001": "Olá, como você está?"},
        cues={"pt_wd-0001": "Uma saudação.", "en_wd-0001": "A greeting."},
        word_maps={"en": [{"word_id": "en-wd-0001", "root_word_id": "wd-0001", "word": "hello"}]},
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
        words=[{"word_id": "wd-0001", "filename": "hello.webp"}],
        content={"pt-en": {"chapters": []}},
        sentences={"en_wd-0001": "Hello, how are you?"},
        cues={"pt_wd-0001": "Uma saudação."},
        word_maps={"en": [{"word_id": "en-wd-0001", "root_word_id": "wd-0001", "word": "hello"}]},
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
                                "sentences": [
                                    {"sentence_number": 1, "content": "Said **hi** and left."}
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
    assert len(topic.sentences) == 1
    assert topic.sentences[0].sentence_number == 1
    assert topic.sentences[0].content == "Said **hi** and left."


def test_get_chapters_resolves_per_language_word_ids_to_the_catalog_root_id(tmp_path):
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
                                "word_ids": ["en-wd-0001", "en-wd-0002"],
                            }
                        ],
                    }
                ]
            }
        },
        word_maps={
            "en": [
                {"word_id": "en-wd-0001", "root_word_id": "wd-0003", "word": "goodbye"},
                {"word_id": "en-wd-0002", "root_word_id": "wd-0001", "word": "hello"},
            ]
        },
    )

    topic = repository.get_chapters(PT_EN)[0].topics[0]

    assert topic.word_ids == ["wd-0003", "wd-0001"]


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


def _content_with_one_topic(chapter_number=1, topic_number=1, word_ids=None):
    return {
        "pt-en": {
            "chapters": [
                {
                    "chapter_id": "ch-01",
                    "number": chapter_number,
                    "title": "T",
                    "description": "D",
                    "topics": [
                        {
                            "topic_id": "top-01",
                            "number": topic_number,
                            "title": "T",
                            "description": "D",
                            "word_ids": word_ids or [],
                        }
                    ],
                }
            ]
        }
    }


def test_get_chapters_maps_phrases_and_resolves_their_word_ids(tmp_path):
    repository = _repository(
        tmp_path,
        content=_content_with_one_topic(),
        word_maps={"en": [{"word_id": "en-wd-0001", "root_word_id": "wd-0001", "word": "hello"}]},
        phrases={
            "en": {
                "chapter_1": {
                    "topic_1": [
                        {"id": "en-sent-0001", "sentence": "Hello there.", "word_ids": ["en-wd-0001"]},
                    ]
                }
            }
        },
    )

    topic = repository.get_chapters(PT_EN)[0].topics[0]

    assert len(topic.phrases) == 1
    phrase = topic.phrases[0]
    assert phrase.id == "en-sent-0001"
    assert phrase.sentence == "Hello there."
    assert phrase.word_ids == ["wd-0001"]


def test_get_chapters_defaults_to_no_phrases_when_file_is_missing(tmp_path):
    repository = _repository(tmp_path, content=_content_with_one_topic())

    topic = repository.get_chapters(PT_EN)[0].topics[0]

    assert topic.phrases == []


def test_get_chapters_only_attaches_phrases_for_the_matching_chapter_and_topic(tmp_path):
    repository = _repository(
        tmp_path,
        content=_content_with_one_topic(chapter_number=1, topic_number=2),
        phrases={
            "en": {
                "chapter_1": {
                    "topic_1": [{"id": "en-sent-0001", "sentence": "Wrong topic.", "word_ids": []}],
                    "topic_2": [{"id": "en-sent-0002", "sentence": "Right topic.", "word_ids": []}],
                },
                "chapter_2": {
                    "topic_1": [{"id": "en-sent-0003", "sentence": "Wrong chapter.", "word_ids": []}],
                },
            }
        },
    )

    topic = repository.get_chapters(PT_EN)[0].topics[0]

    assert [p.sentence for p in topic.phrases] == ["Right topic."]
