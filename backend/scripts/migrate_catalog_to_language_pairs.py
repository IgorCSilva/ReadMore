#!/usr/bin/env python3
"""One-off migration: key catalog.json by explicit origin-target language
pair (e.g. "pt-en") instead of a bare target-language name ("english").

All current content is Portuguese-origin — hardcoded here, since there's no
other origin language in the catalog yet (RESTRUCTURE_REQUIREMENTS.md §5's
scope boundary: this phase makes the data structure pair-agnostic, it
doesn't author content for a new origin language). Run once:

    python3 backend/scripts/migrate_catalog_to_language_pairs.py

Only renames top-level keys — every nested value is carried over unchanged,
and the file's existing formatting (2-space indent, unescaped UTF-8,
trailing newline) is preserved so the diff is just the key renames.
"""
import json
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parent.parent / "catalog.json"

LEGACY_NAME_TO_PAIR_KEY = {
    "english": "pt-en",
    "spanish": "pt-es",
}


def main() -> None:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    unknown = set(catalog.keys()) - set(LEGACY_NAME_TO_PAIR_KEY.keys())
    if unknown:
        raise SystemExit(f"no pair-key mapping for: {sorted(unknown)}")

    migrated = {LEGACY_NAME_TO_PAIR_KEY[name]: value for name, value in catalog.items()}

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(migrated, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"migrated keys: {list(catalog.keys())} -> {list(migrated.keys())}")


if __name__ == "__main__":
    main()
