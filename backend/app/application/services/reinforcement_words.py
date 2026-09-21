"""Reinforcement words: word_ids pulled from earlier topics for spaced
review, recomputed fresh from each topic's word_ids every time (no stored
state), then split evenly across the learning tabs so every reinforcement
word is used exactly once.

Selection follows a fixed 10-slot cycle over the previous topics' word_ids,
concatenated in chapter/topic order: get 3, skip 3, get 1, skip 3. The
cycle's starting offset shifts by one slot per topic
(`(topics_before - 1) mod 10`) so consecutive topics draw from different
points in the cycle instead of always restarting at position 0.
"""
from backend.app.domain.entities import Chapter

_CYCLE_LENGTH = 10
_GET_POSITIONS = {0, 1, 2, 6}

REINFORCEMENT_TABS = ["reading", "dictation", "quiz", "phrases"]


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


def split_evenly(items: list[str], group_count: int) -> list[list[str]]:
    """Split items into group_count contiguous, near-equal groups, using
    every item exactly once. Extra items (when the count doesn't divide
    evenly) go one-per-group to the earliest groups first."""
    if group_count <= 0:
        raise ValueError("group_count must be positive")

    base, remainder = divmod(len(items), group_count)
    groups = []
    start = 0
    for i in range(group_count):
        size = base + (1 if i < remainder else 0)
        groups.append(items[start : start + size])
        start += size
    return groups


def reinforcement_words_by_tab(
    chapters: list[Chapter],
    chapter_number: int,
    topic_number: int,
    tabs: list[str] | None = None,
) -> dict[str, list[str]]:
    """Reinforcement word_ids for a topic, split evenly across `tabs`
    (defaults to REINFORCEMENT_TABS) — every reinforcement word is assigned
    to exactly one tab."""
    tabs = tabs if tabs is not None else REINFORCEMENT_TABS
    word_ids = reinforcement_word_ids(chapters, chapter_number, topic_number)
    groups = split_evenly(word_ids, len(tabs))
    return dict(zip(tabs, groups))
