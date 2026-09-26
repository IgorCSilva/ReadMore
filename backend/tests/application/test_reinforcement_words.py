from backend.app.application.services.reinforcement_words import reinforcement_word_ids
from backend.app.domain.entities import Chapter, Topic


def _topic(number: int, word_ids: list[str], topic_id: str | None = None) -> Topic:
    return Topic(
        topic_id=topic_id or f"top-{number}",
        number=number,
        title="T",
        description="D",
        word_ids=word_ids,
    )


def _chapter(number: int, topics: list[Topic]) -> Chapter:
    return Chapter(chapter_id=f"ch-{number}", number=number, title="C", description="D", topics=topics)


def _words(chapter: int, topic: int, count: int = 8) -> list[str]:
    return [f"wd{i}-ch{chapter}-top{topic}" for i in range(1, count + 1)]


# Mirrors the worked example: chapter 1 has topics 1-3, chapter 2 has topics
# 1-2, chapter 3 has topics 1-4 — each topic contributing 8 words.
CHAPTERS = [
    _chapter(1, [_topic(1, _words(1, 1)), _topic(2, _words(1, 2)), _topic(3, _words(1, 3))]),
    _chapter(2, [_topic(1, _words(2, 1)), _topic(2, _words(2, 2))]),
    _chapter(3, [_topic(1, _words(3, 1)), _topic(2, _words(3, 2)), _topic(3, _words(3, 3)), _topic(4, _words(3, 4))]),
]


def test_first_topic_of_the_first_chapter_has_no_reinforcement_words():
    assert reinforcement_word_ids(CHAPTERS, chapter_number=1, topic_number=1) == []


def test_second_topic_starts_the_cycle_at_its_first_get_slot():
    result = reinforcement_word_ids(CHAPTERS, chapter_number=1, topic_number=2)

    assert result == ["wd1-ch1-top1", "wd2-ch1-top1", "wd3-ch1-top1", "wd7-ch1-top1"]


def test_pulls_from_every_earlier_topic_across_chapters_in_order():
    result = reinforcement_word_ids(CHAPTERS, chapter_number=3, topic_number=1)

    assert result == [
        "wd3-ch1-top1", "wd7-ch1-top1", "wd8-ch1-top1",
        "wd1-ch1-top2", "wd5-ch1-top2",
        "wd1-ch1-top3", "wd2-ch1-top3", "wd3-ch1-top3", "wd7-ch1-top3",
        "wd3-ch2-top1", "wd4-ch2-top1", "wd5-ch2-top1",
        "wd1-ch2-top2", "wd5-ch2-top2", "wd6-ch2-top2", "wd7-ch2-top2",
    ]


def test_last_topic_pulls_from_every_other_topic_in_the_book():
    result = reinforcement_word_ids(CHAPTERS, chapter_number=3, topic_number=4)

    assert result == [
        "wd4-ch1-top1", "wd5-ch1-top1", "wd6-ch1-top1",
        "wd2-ch1-top2", "wd6-ch1-top2", "wd7-ch1-top2", "wd8-ch1-top2",
        "wd4-ch1-top3", "wd8-ch1-top3",
        "wd1-ch2-top1", "wd2-ch2-top1", "wd6-ch2-top1",
        "wd2-ch2-top2", "wd3-ch2-top2", "wd4-ch2-top2", "wd8-ch2-top2",
        "wd4-ch3-top1", "wd5-ch3-top1", "wd6-ch3-top1",
        "wd2-ch3-top2", "wd6-ch3-top2", "wd7-ch3-top2", "wd8-ch3-top2",
        "wd4-ch3-top3", "wd8-ch3-top3",
    ]


def test_ignores_chapter_and_topic_declaration_order_in_the_input_list():
    shuffled = [CHAPTERS[2], CHAPTERS[0], CHAPTERS[1]]
    shuffled[1] = _chapter(1, list(reversed(CHAPTERS[0].topics)))

    result = reinforcement_word_ids(shuffled, chapter_number=1, topic_number=2)

    assert result == ["wd1-ch1-top1", "wd2-ch1-top1", "wd3-ch1-top1", "wd7-ch1-top1"]
