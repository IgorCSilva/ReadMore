"""Finds a sentence's word_id entries whose target-language spelling never
appears anywhere in that sentence's own text -- the signature of a wrong
id being recorded while the sentence was authored (see the chapter_2/
topic_4 "mi"/"sí" and "de"/"estás" mixups this script was written after:
every wrong id there belonged to chapter_1/topic_1's word list instead of
chapter_2/topic_4's, i.e. the wrong *topic's* words.json was consulted).

This mistake isn't caught anywhere else. backend/words/<target>_words.json
is a correct, consistent word_id -> spelling dictionary, but nothing
enforces that a sentence's word_ids were assembled *correctly* against it
-- the backend load path (JsonCatalogRepository._to_phrase) just forwards
whatever ids are already sitting in a chapter/topic's sentences.json. A
wrong-but-structurally-valid id (it resolves to a real word, just not one
in this sentence) sails through JSON parsing and the API response
untouched. It only surfaces indirectly in the app, because Phrases.vue's
blank-renderer silently skips any word_id it can't find a text match for
-- so the visible symptom is "this sentence has fewer blanks than
word_ids", not an error.

This check is deliberately narrow: it only verifies a word_id's spelling
is PRESENT somewhere in the sentence, not that the array's length/order
is what a human author intended. Re-deriving a fully correct word_ids
array from scratch is a harder, scope-sensitive problem -- a sentence can
legitimately omit ids for vocabulary not yet taught at that point in the
curriculum, and this script has no way to know that cutoff. So a clean
run here does not guarantee a sentence's word_ids are complete or
correctly ordered, only that none of them are outright wrong.

Usage:
    python backend/scripts/check_sentence_word_ids.py <target_language> [chapter] [topic]

Examples:
    python backend/scripts/check_sentence_word_ids.py es
    python backend/scripts/check_sentence_word_ids.py es 2 4
"""

import argparse
import json
import re
import sys
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"
WORDS_DIR = Path(__file__).resolve().parent.parent / "words"

_LETTERS = "a-zA-ZÀ-ÿ"


def load_json(path):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def load_word_spellings(target_language):
    """word_id -> lowercased spelling, straight from
    backend/words/<target>_words.json -- the one authoritative source."""
    path = WORDS_DIR / f"{target_language}_words.json"
    if not path.exists():
        raise SystemExit(f"No word list found for target language '{target_language}': {path}")
    return {row["word_id"]: row["word"].lower() for row in load_json(path)}


def contains_word(sentence, spelling):
    """Whole-word/phrase, case-insensitive, boundary-anchored match -- a
    multi-word entry (e.g. "en la") must appear as that exact phrase, not
    as its words scattered elsewhere in the sentence."""
    pattern = re.compile(rf"(?<![{_LETTERS}]){re.escape(spelling)}(?![{_LETTERS}])", re.IGNORECASE)
    return pattern.search(sentence) is not None


def iter_sentence_files(target_language, chapter=None, topic=None):
    # Sentences for a target language live directly under
    # content/<target_language>/..., not under a pair directory -- see
    # JsonCatalogRepository._load_phrases.
    target_dir = CONTENT_DIR / target_language
    if not target_dir.is_dir():
        raise SystemExit(f"No content directory found for target language '{target_language}': {target_dir}")

    if chapter is not None and topic is not None:
        path = target_dir / f"chapter_{chapter}" / f"topic_{topic}" / "sentences.json"
        if not path.exists():
            raise SystemExit(f"chapter {chapter} topic {topic} not found for '{target_language}'")
        return [path]

    return sorted(target_dir.glob("chapter_*/topic_*/sentences.json"))


def check(target_language, chapter=None, topic=None):
    spellings = load_word_spellings(target_language)
    problems = []

    for path in iter_sentence_files(target_language, chapter, topic):
        for row in load_json(path):
            for word_id in row["word_ids"]:
                spelling = spellings.get(word_id)
                if spelling is None:
                    problems.append((path, row["id"], word_id, "(unknown word_id)", row["sentence"]))
                    continue
                if not contains_word(row["sentence"], spelling):
                    problems.append((path, row["id"], word_id, spelling, row["sentence"]))

    return problems


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("target_language", help="Target language code, e.g. es, en, zh")
    parser.add_argument("chapter", nargs="?", type=int, help="Optional: restrict to one chapter")
    parser.add_argument("topic", nargs="?", type=int, help="Optional: restrict to one topic (requires chapter)")
    args = parser.parse_args()

    if args.topic is not None and args.chapter is None:
        parser.error("topic requires chapter")

    problems = check(args.target_language, args.chapter, args.topic)

    if not problems:
        scope = f"chapter {args.chapter} topic {args.topic}" if args.topic else "all chapters/topics"
        print(f"No wrong word_ids found for '{args.target_language}' ({scope}).")
        return 0

    for path, sent_id, word_id, spelling, sentence in problems:
        print(f"{path.relative_to(CONTENT_DIR.parent.parent)}")
        print(f"  {sent_id}  {word_id} ('{spelling}') not found in: {sentence}")

    print(f"\n{len(problems)} wrong word_id reference(s) found.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
