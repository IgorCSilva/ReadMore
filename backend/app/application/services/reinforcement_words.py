"""Reinforcement words: word_ids pulled from earlier topics for spaced
review, recomputed fresh from each topic's word_ids every time (no stored
state).

Selection follows a fixed 10-slot cycle over the previous topics' word_ids,
concatenated in chapter/topic order: get 3, skip 3, get 1, skip 3. The
cycle's starting offset shifts by one slot per topic
(`(topics_before - 1) mod 10`) so consecutive topics draw from different
points in the cycle instead of always restarting at position 0.
"""
from backend.app.domain.entities import Chapter

_CYCLE_LENGTH = 10
_GET_POSITIONS = {0, 1, 2, 6}


def reinforcement_word_ids(chapters: list[Chapter], chapter_number: int, topic_number: int) -> list[str]:
    """word_ids from every topic before (chapter_number, topic_number) — in
    chapter/topic order — filtered down to the reinforcement cycle's "get"
    slots. Empty when there are no earlier topics."""
    ordered_topics = sorted(
        ((chapter.number, topic.number, topic) for chapter in chapters for topic in chapter.topics),
        key=lambda item: (item[0], item[1]),
    )
    target = (chapter_number, topic_number)

    previous_word_ids = [
        word_id
        for number, top_number, topic in ordered_topics
        if (number, top_number) < target
        for word_id in topic.word_ids
    ]
    if not previous_word_ids:
        return []

    topics_before = sum(1 for number, top_number, _ in ordered_topics if (number, top_number) < target)
    start = (topics_before - 1) % _CYCLE_LENGTH

    return [
        word_id
        for index, word_id in enumerate(previous_word_ids)
        if (start + index) % _CYCLE_LENGTH in _GET_POSITIONS
    ]
