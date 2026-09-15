#!/usr/bin/env python3
"""One-off migration (already run — kept as a historical record): split
backend/catalog.json's per-pair {words, chapters} shape into a shared,
concept-based words catalog plus per-pair content and language-keyed
sentence/cue files.

Two follow-up changes happened manually right after this script ran, not
reflected below: the three output files (catalog.json, sentences.json,
cues.json) moved into their own backend/words/ folder, and catalog.json's
per-word spelling field was renamed from the full pair ("pt-en") to the bare
target-language code ("en") — origin doesn't matter there. Do not re-run this
script expecting it to reproduce the current file layout/keys as-is.

Before:
    catalog.json = {"pt-en": {"words": [...], "chapters": [...]},
                     "pt-es": {"words": [...], "chapters": [...]}}
    each pt-en word: {word_id: "en-0242", original, filename, sentence, cue}

After:
    catalog.json      = {"words": [{"word_id": "wd-0242", "filename": ...,
                                     "pt-en": "<original>"}, ...]}
    content/pt-en.json = {"chapters": [...]}   # word_id refs now wd-XXXX
    content/pt-es.json = {"chapters": []}      # untouched, still empty
    sentences.json     = {"en_wd-0242": "<old sentence>",
                           "pt_wd-0242": "<authored Portuguese sentence>"}
    cues.json           = {"pt_wd-0242": "<old cue>",
                            "en_wd-0242": "<authored English cue>"}

Every pt-en word_id is renumbered en-0001..en-0259 -> wd-0001..wd-0259,
preserving array order 1:1 (no reordering). The old->new mapping is written
to backend/scripts/_word_id_mapping.json — needed separately to remap the
live Google Sheet's progress rows via the Apps Script `remap_word_ids`
action (a distinct, explicitly-confirmed step; this script never touches the
Sheet).

pt-es has no words/chapters yet (still an empty scaffold), so there's nothing
to migrate for it beyond writing its own empty content file.

Run once, from the repo root:

    python3 backend/scripts/migrate_words_catalog.py
"""
import json
from pathlib import Path

from _words_translations import TRANSLATIONS

BACKEND_DIR = Path(__file__).resolve().parent.parent
CATALOG_PATH = BACKEND_DIR / "catalog.json"
CONTENT_DIR = BACKEND_DIR / "content"
SENTENCES_PATH = BACKEND_DIR / "sentences.json"
CUES_PATH = BACKEND_DIR / "cues.json"
MAPPING_PATH = Path(__file__).resolve().parent / "_word_id_mapping.json"

PAIR = "pt-en"


def _dump(path: Path, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _remap_word_ids_in_place(obj, mapping: dict[str, str]) -> None:
    """Walks chapters/topics/texts/exercises structurally (exercises are
    untyped dicts) and rewrites every word_id string found in a `word_ids` or
    `word_bank` list, in place."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ("word_ids", "word_bank") and isinstance(value, list):
                obj[key] = [mapping.get(v, v) for v in value]
            else:
                _remap_word_ids_in_place(value, mapping)
    elif isinstance(obj, list):
        for item in obj:
            _remap_word_ids_in_place(item, mapping)


def main() -> None:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        old_catalog = json.load(f)

    old_words = old_catalog[PAIR]["words"]
    missing = [w["word_id"] for w in old_words if w["word_id"] not in TRANSLATIONS]
    if missing:
        raise SystemExit(f"no authored translation for: {missing}")

    mapping = {w["word_id"]: f"wd-{i:04d}" for i, w in enumerate(old_words, start=1)}

    new_words = []
    sentences = {}
    cues = {}
    for old in old_words:
        old_id = old["word_id"]
        new_id = mapping[old_id]
        new_words.append({
            "word_id": new_id,
            "filename": old["filename"],
            PAIR: old["original"],
        })
        sentences[f"en_{new_id}"] = old["sentence"]
        sentences[f"pt_{new_id}"] = TRANSLATIONS[old_id]["pt_sentence"]
        cues[f"pt_{new_id}"] = old["cue"]
        cues[f"en_{new_id}"] = TRANSLATIONS[old_id]["en_cue"]

    _dump(CATALOG_PATH, {"words": new_words})

    CONTENT_DIR.mkdir(exist_ok=True)

    pt_en_content = {"chapters": old_catalog[PAIR].get("chapters", [])}
    _remap_word_ids_in_place(pt_en_content, mapping)
    _dump(CONTENT_DIR / f"{PAIR}.json", pt_en_content)

    other_pairs = [k for k in old_catalog if k != PAIR]
    for pair in other_pairs:
        _dump(CONTENT_DIR / f"{pair}.json", {"chapters": old_catalog[pair].get("chapters", [])})

    _dump(SENTENCES_PATH, sentences)
    _dump(CUES_PATH, cues)
    _dump(MAPPING_PATH, mapping)

    print(f"words migrated: {len(new_words)} ({PAIR})")
    print(f"content files: {PAIR}, {', '.join(other_pairs)}")
    print(f"sentences.json entries: {len(sentences)}")
    print(f"cues.json entries: {len(cues)}")
    print(f"old->new word_id mapping written to {MAPPING_PATH}")


if __name__ == "__main__":
    main()
