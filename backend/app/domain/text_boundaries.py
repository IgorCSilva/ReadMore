"""Per-target-language word-boundary strategies for matching a correction's
variant text within a larger string (see application/services/corrections.py).

"Does this variant stand as its own word here" isn't a universal regex: it
depends on how the target language delimits words. Space-delimited languages
(pt, es, en, ...) can rely on a plain \\b/\\b anchor. Korean glues particles
and endings directly onto the preceding word with no space (e.g. "학교" +
"에" -> "학교에"), so a trailing \\b never fires there — only the start needs
anchoring, which also keeps the match from firing mid-word (e.g. "학교" inside
"중학교"). French elides a handful of short pronouns/articles before a
vowel/h, dropping their final letter and gluing an apostrophe straight onto
the next word (e.g. "je" + "me" + "appelle" -> "je m'appelle") — a plain
\\bme\\b never fires there either, since the literal substring "me" is gone.

New target languages default to the Latin/space-delimited strategy; add an
entry to _STRATEGIES only when a language's word-boundary rules genuinely
differ from that default.
"""
import re
from typing import Callable

_HANGUL_SYLLABLES = "가-힣"

# Short French pronouns/articles that elide (drop their final vowel, glue an
# apostrophe onto what follows) before a vowel or mute h. Keyed by the
# dictionary form actually tracked as a vocabulary word.
_FRENCH_ELISIONS = {
    "je": "j'", "me": "m'", "te": "t'", "se": "s'",
    "le": "l'", "la": "l'", "ne": "n'", "de": "d'",
    "que": "qu'", "ce": "c'",
}


def _latin_boundary(word: str) -> str:
    return rf"\b{re.escape(word)}\b"


def _korean_boundary(word: str) -> str:
    return rf"(?<![{_HANGUL_SYLLABLES}]){re.escape(word)}"


def _french_boundary(word: str) -> str:
    plain = _latin_boundary(word)
    elision = _FRENCH_ELISIONS.get(word.lower())
    if not elision:
        return plain
    return rf"(?:{plain}|\b{re.escape(elision)})"


_STRATEGIES: dict[str, Callable[[str], str]] = {
    "ko": _korean_boundary,
    "fr": _french_boundary,
}


def boundary_pattern(word: str, target_lang: str) -> str:
    """A regex fragment matching `word` anchored to a legitimate word
    boundary for `target_lang`."""
    strategy = _STRATEGIES.get(target_lang, _latin_boundary)
    return strategy(word)
