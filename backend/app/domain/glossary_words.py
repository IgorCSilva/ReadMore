"""Filters a shared glossary.json's full word/phrase list down to just the
entries that actually appear in one story/topic's `sentences` — used by
JsonStoriesRepository and JsonLearningContentRepository so a pair's whole
glossary doesn't ship with every story/topic.

Most glossary keys are a single word, matched by exact normalized token.
A few are a multi-word phrase (e.g. "método del plato", "phrasal verb"-style
terms whose meaning isn't just its words' meanings added together) — those
match a contiguous run of normalized tokens within one `sentences` entry.
Mirrors the frontend's tokenizeStoryWords phrase-merging (frontend/src/
shared/text.ts) so the two stay in lockstep: normalization here strips only
leading/trailing non-letter/non-digit characters (keeping internal
apostrophes/hyphens), lowercases, and folds curly apostrophes to straight
ones.
"""
import re

_EDGE_PUNCTUATION_RE = re.compile(r"^[^\w]+|[^\w]+$", re.UNICODE)
_CURLY_APOSTROPHE_RE = re.compile("[‘’]")


def _normalize_tokens(sentence: str) -> list[str]:
    tokens = []
    for raw in sentence.split():
        stripped = _EDGE_PUNCTUATION_RE.sub("", raw)
        if stripped:
            tokens.append(_CURLY_APOSTROPHE_RE.sub("'", stripped.lower()))
    return tokens


def filter_glossary(glossary: dict[str, dict], sentences: list[str]) -> dict[str, dict]:
    """Subsets `glossary` to the keys appearing in `sentences`, keyed the
    same way as the input (word or "word word" phrase -> raw entry dict)."""
    single_keys = {key for key in glossary if " " not in key}
    phrase_keys = {key: key.split(" ") for key in glossary if " " in key}

    matched: set[str] = set()
    for sentence in sentences:
        tokens = _normalize_tokens(sentence)
        matched |= single_keys & set(tokens)
        for key, words in phrase_keys.items():
            n = len(words)
            for i in range(len(tokens) - n + 1):
                if tokens[i : i + n] == words:
                    matched.add(key)
                    break

    return {key: entry for key, entry in glossary.items() if key in matched}
