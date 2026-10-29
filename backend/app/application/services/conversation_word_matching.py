"""Finds which of a user's tracked conversation words appear in a message
they typed.

Reuses domain/text_boundaries.py's per-target-language word-boundary rules
(the same ones corrections.py relies on) since a tracked word can be a
multi-word phrase (e.g. "de nada") and plain substring matching would both
miss phrase boundaries and wrongly match a word inside a longer one (e.g.
"nada" inside "anadie"). Unlike corrections.py, this only detects presence
rather than rewriting text, so there's no need to resolve overlapping
matches into a single longest-match-wins pass — a message containing
"de nada" is allowed to match both "nada" and "de nada".
"""
import re

from backend.app.domain.entities import ConversationWordUsage
from backend.app.domain.text_boundaries import boundary_pattern


def match_word_ids(
    message: str, words: list[ConversationWordUsage], target_lang: str
) -> list[str]:
    matched: list[str] = []
    for usage in words:
        pattern = re.compile(boundary_pattern(usage.word, target_lang), re.IGNORECASE)
        if pattern.search(message):
            matched.append(usage.word_id)
    return matched
