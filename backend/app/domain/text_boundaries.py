"""Per-target-language word-boundary strategies for matching a correction's
variant text within a larger string (see application/services/corrections.py).

"Does this variant stand as its own word here" isn't a universal regex: it
depends on how the target language delimits words. Space-delimited languages
(pt, es, en, ...) can rely on a plain \\b/\\b anchor. Korean glues particles
and endings directly onto the preceding word with no space (e.g. "학교" +
"에" -> "학교에"), so a trailing \\b never fires there — only the start needs
anchoring, which also keeps the match from firing mid-word (e.g. "학교" inside
"중학교").

New target languages default to the Latin/space-delimited strategy; add an
entry to _STRATEGIES only when a language's word-boundary rules genuinely
differ from that default.
"""
from typing import Callable

_HANGUL_SYLLABLES = "가-힣"


def _latin_boundary(escaped_variant: str) -> str:
    return rf"\b{escaped_variant}\b"


def _korean_boundary(escaped_variant: str) -> str:
    return rf"(?<![{_HANGUL_SYLLABLES}]){escaped_variant}"


_STRATEGIES: dict[str, Callable[[str], str]] = {
    "ko": _korean_boundary,
}


def boundary_pattern(escaped_variant: str, target_lang: str) -> str:
    """A regex fragment matching `escaped_variant` (already re.escape'd)
    anchored to a legitimate word boundary for `target_lang`."""
    strategy = _STRATEGIES.get(target_lang, _latin_boundary)
    return strategy(escaped_variant)
