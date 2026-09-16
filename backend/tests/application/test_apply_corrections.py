from backend.app.application.services.corrections import apply_corrections
from backend.app.domain.entities import Chapter, Correction, Text, Topic


def _chapter(number: int, topics: list[Topic]) -> Chapter:
    return Chapter(
        chapter_id=f"ch-{number:02d}", number=number, title="C", description="D", topics=topics
    )


def _topic(number: int, body: str = "", exercises: list[dict] | None = None) -> Topic:
    return Topic(
        topic_id=f"top-{number:02d}",
        number=number,
        title="T",
        description="D",
        word_ids=[],
        texts=[Text(text_id="txt-01", number=1, title="Title", body=body)],
        exercises=exercises or [],
    )


def test_one_to_one_replacement_is_bolded():
    chapters = [_chapter(1, [_topic(1, body="avó says hi")])]
    correction = Correction(chapter_number=1, topic_number=1, current=["avó"], correction=["abuela"])

    result = apply_corrections(chapters, [correction])

    assert result[0].topics[0].texts[0].body == "**abuela** says hi"


def test_n_to_one_replaces_every_variant():
    chapters = [_chapter(1, [_topic(1, body="meu carro e minha casa")])]
    correction = Correction(
        chapter_number=1, topic_number=1, current=["meu", "minha"], correction=["mi"]
    )

    result = apply_corrections(chapters, [correction])

    assert result[0].topics[0].texts[0].body == "**mi** carro e **mi** casa"


def test_one_to_n_joins_options_with_slash():
    chapters = [_chapter(1, [_topic(1, body="mi carro")])]
    correction = Correction(
        chapter_number=1, topic_number=1, current=["mi"], correction=["meu", "minha"]
    )

    result = apply_corrections(chapters, [correction])

    assert result[0].topics[0].texts[0].body == "**meu/minha** carro"


def test_earlier_chapter_is_untouched():
    chapters = [_chapter(1, [_topic(1, body="avó")]), _chapter(2, [_topic(1, body="avó")])]
    correction = Correction(chapter_number=2, topic_number=1, current=["avó"], correction=["abuela"])

    result = apply_corrections(chapters, [correction])

    assert result[0].topics[0].texts[0].body == "avó"
    assert result[1].topics[0].texts[0].body == "**abuela**"


def test_earlier_topic_in_same_chapter_is_untouched_later_topic_is_corrected():
    chapters = [_chapter(2, [_topic(3, body="avó"), _topic(4, body="avó")])]
    correction = Correction(chapter_number=2, topic_number=4, current=["avó"], correction=["abuela"])

    result = apply_corrections(chapters, [correction])

    topics_by_number = {t.number: t for t in result[0].topics}
    assert topics_by_number[3].texts[0].body == "avó"
    assert topics_by_number[4].texts[0].body == "**abuela**"


def test_later_chapter_always_included_regardless_of_topic_number():
    chapters = [_chapter(3, [_topic(1, body="avó")])]
    correction = Correction(chapter_number=2, topic_number=5, current=["avó"], correction=["abuela"])

    result = apply_corrections(chapters, [correction])

    assert result[0].topics[0].texts[0].body == "**abuela**"


def test_exercises_are_replaced_recursively():
    exercises = [
        {
            "sentence": "avó says hi",
            "items": [{"answer": "avó"}, {"answer": "other"}],
            "word_bank": ["avó", "casa"],
        }
    ]
    chapters = [_chapter(1, [_topic(1, exercises=exercises)])]
    correction = Correction(chapter_number=1, topic_number=1, current=["avó"], correction=["abuela"])

    result = apply_corrections(chapters, [correction])

    result_exercise = result[0].topics[0].exercises[0]
    assert result_exercise["sentence"] == "**abuela** says hi"
    assert result_exercise["items"][0]["answer"] == "**abuela**"
    assert result_exercise["items"][1]["answer"] == "other"
    assert result_exercise["word_bank"] == ["**abuela**", "casa"]


def test_longer_variant_matched_before_shorter_substring():
    chapters = [_chapter(1, [_topic(1, body="meu problema e meu carro")])]
    corrections = [
        Correction(chapter_number=1, topic_number=1, current=["meu"], correction=["mi"]),
        Correction(
            chapter_number=1, topic_number=1, current=["meu problema"], correction=["mi problema"]
        ),
    ]

    result = apply_corrections(chapters, corrections)

    assert result[0].topics[0].texts[0].body == "**mi problema** e **mi** carro"


def test_a_correction_does_not_re_match_inside_another_corrections_replacement():
    # Regression: "avó" -> "abuela" followed by "ela" -> "ella" must not let
    # the second correction match the "ela" substring that appears inside
    # the *replacement* text "abuela", corrupting it into "abu**ella**".
    chapters = [_chapter(1, [_topic(1, body="avó disse que ela ficou feliz")])]
    corrections = [
        Correction(chapter_number=1, topic_number=1, current=["avó"], correction=["abuela"]),
        Correction(chapter_number=1, topic_number=1, current=["ela"], correction=["ella"]),
    ]

    result = apply_corrections(chapters, corrections)

    assert result[0].topics[0].texts[0].body == "**abuela** disse que **ella** ficou feliz"


def test_variant_only_matches_whole_words_not_substrings_of_other_words():
    # Regression: "ela" must not match inside "abuela", "aquela", "dela" —
    # it's a substring of plenty of unrelated words, not just the pronoun.
    chapters = [
        _chapter(
            1,
            [
                _topic(
                    1,
                    body="ela e a abuela foram aquela casa amarela e falei dela na janela",
                )
            ],
        )
    ]
    correction = Correction(chapter_number=1, topic_number=1, current=["ela"], correction=["ella"])

    result = apply_corrections(chapters, [correction])

    assert result[0].topics[0].texts[0].body == (
        "**ella** e a abuela foram aquela casa amarela e falei dela na janela"
    )
