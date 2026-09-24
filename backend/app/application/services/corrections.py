"""Applies user-submitted corrections to chapter content before it's served.

A correction reported at chapter C / topic T is forward-only: it rewrites
every topic from T onward within chapter C, and every topic in any later
chapter, but leaves earlier chapters/topics untouched. Matched spans are
wrapped in **bold**, the markdown convention Texts.vue/Exercises.vue already
render as <strong>. Only Topic.texts[].body and Topic.exercises (walked
recursively, since exercise item shapes vary by type) are rewritten — Word
data (catalog/sentences/cues) is untouched.
"""
import re
from dataclasses import replace

from backend.app.domain.entities import Chapter, Correction, Topic
from backend.app.domain.text_boundaries import boundary_pattern

_ReplacementPairs = list[tuple[str, str]]
_Matcher = tuple[re.Pattern, dict[str, str]]


def apply_corrections(
    chapters: list[Chapter], corrections: list[Correction], target_lang: str
) -> list[Chapter]:
    return [_apply_to_chapter(chapter, corrections, target_lang) for chapter in chapters]


def _apply_to_chapter(chapter: Chapter, corrections: list[Correction], target_lang: str) -> Chapter:
    topics = [
        _apply_to_topic(chapter.number, topic, corrections, target_lang) for topic in chapter.topics
    ]
    return replace(chapter, topics=topics)


def _apply_to_topic(
    chapter_number: int, topic: Topic, corrections: list[Correction], target_lang: str
) -> Topic:
    pairs = _applicable_pairs(chapter_number, topic.number, corrections)
    if not pairs:
        return topic
    matcher = _build_matcher(pairs, target_lang)
    texts = [replace(t, body=_replace_text(t.body, matcher)) for t in topic.texts]
    exercises = [_replace_value(item, matcher) for item in topic.exercises]
    return replace(topic, texts=texts, exercises=exercises)


def _applicable_pairs(
    chapter_number: int, topic_number: int, corrections: list[Correction]
) -> _ReplacementPairs:
    """(current_variant, "**joined correction**") pairs for corrections whose
    origin is at or before this chapter/topic."""
    pairs: _ReplacementPairs = []
    for correction in corrections:
        is_later_chapter = chapter_number > correction.chapter_number
        is_same_chapter_later_topic = (
            chapter_number == correction.chapter_number
            and topic_number >= correction.topic_number
        )
        if not (is_later_chapter or is_same_chapter_later_topic):
            continue
        replacement = "**" + "/".join(correction.correction) + "**"
        for variant in correction.current:
            pairs.append((variant, replacement))
    return pairs


def _build_matcher(pairs: _ReplacementPairs, target_lang: str) -> _Matcher:
    """A single regex alternation over every variant, longest first so
    overlapping candidates at the same position prefer the longer match, and
    each variant anchored to a word boundary appropriate for target_lang
    (see domain/text_boundaries.py — word-boundary rules vary by script).

    Two things could otherwise corrupt unrelated words: (1) one sequential
    str.replace per correction would let a later correction's `current`
    match inside an earlier correction's freshly-inserted replacement text
    (e.g. "avo"->"abuela" then "ela"->"ella" re-matching the "ela" just
    inserted) — a single regex pass avoids this since re.sub only ever
    matches against the original input, never text it has just substituted
    in; (2) even in one pass, an unanchored "ela" is a substring of plenty of
    unrelated words ("abuela", "aquela", "janela", "dela") — the boundary
    anchors restrict a match to the variant appearing as its own word/phrase.
    """
    mapping: dict[str, str] = {}
    for variant, replacement in pairs:
        mapping.setdefault(variant, replacement)
    ordered_variants = sorted(mapping, key=len, reverse=True)
    pattern = re.compile(
        "|".join(
            boundary_pattern(re.escape(variant), target_lang) for variant in ordered_variants
        )
    )
    return pattern, mapping


def _replace_text(text: str, matcher: _Matcher) -> str:
    pattern, mapping = matcher
    return pattern.sub(lambda m: mapping[m.group(0)], text)


def _replace_value(value, matcher: _Matcher):
    if isinstance(value, str):
        return _replace_text(value, matcher)
    if isinstance(value, list):
        return [_replace_value(v, matcher) for v in value]
    if isinstance(value, dict):
        return {k: _replace_value(v, matcher) for k, v in value.items()}
    return value
