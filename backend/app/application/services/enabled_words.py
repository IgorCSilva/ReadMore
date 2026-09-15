"""Shared rule for which word_ids are enabled for a user: a word is enabled
iff it belongs to a topic enabled for that user (TopicsRepository), full stop
— no separate per-word opt-in. GetUserWords, MarkWordKnown, ShowWordAgain and
IncrementShownCount all gate on this instead of on progress-row presence.
"""
from backend.app.domain.entities import Chapter


def enabled_word_ids(chapters: list[Chapter], enabled_topic_ids: set[str]) -> set[str]:
    return {
        word_id
        for chapter in chapters
        for topic in chapter.topics
        if topic.topic_id in enabled_topic_ids
        for word_id in topic.word_ids
    }
