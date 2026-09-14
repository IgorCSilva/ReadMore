"""Maps between the legacy bare-target-language names ("english") still used
by the real Google Sheets progress/topics data, and the LanguagePair this
app models internally as of RESTRUCTURE_PLAN.md Steps 3.1/3.2.

Two one-way uses:
- parse_language_pair(): HTTP boundary (main.py) — turns a raw ?lang=...
  value, legacy or pair-key, into a LanguagePair before calling a use case.
- to_legacy_name(): the Sheets-backed repositories — turns a LanguagePair
  back into the legacy name their HTTP calls to the real sheet still need,
  regardless of what format the rest of the app now uses.

Superseded once Phase 4 migrates the sheet schema to key on the pair
directly — see RESTRUCTURE_PLAN.md's Phase 3/4 notes on this coupling.
"""
from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import LanguagePair

LEGACY_NAME_TO_PAIR = {
    "english": LanguagePair(origin="pt", target="en"),
    "spanish": LanguagePair(origin="pt", target="es"),
}
PAIR_TO_LEGACY_NAME = {pair: name for name, pair in LEGACY_NAME_TO_PAIR.items()}


def parse_language_pair(raw: str) -> LanguagePair:
    """Accepts either a legacy name ("english") or a pair key ("pt-en").
    Raises LanguageNotFoundError for anything that's neither — the same
    "unknown language" a caller would see if the value simply didn't match
    a catalog entry, since from the caller's perspective it doesn't."""
    if raw in LEGACY_NAME_TO_PAIR:
        return LEGACY_NAME_TO_PAIR[raw]
    try:
        return LanguagePair.parse(raw)
    except ValueError:
        raise LanguageNotFoundError(raw) from None


def to_legacy_name(pair: LanguagePair) -> str:
    """Sheets-compatible lang value for this pair, falling back to the
    pair's own string form if there's no legacy alias for it (a genuinely
    new pair, never having had a legacy name to begin with)."""
    return PAIR_TO_LEGACY_NAME.get(pair, str(pair))
