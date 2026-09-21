"""Remove, from a topic's word list, any word that also appears in another
chapter/topic of the same backend/content/<language>.json file — i.e. the
same duplicates reported by check_word_duplicates.py.

The word is only removed from the topic given as argument; the other
topic(s) where it also appears are left untouched.

Usage:
    python backend/scripts/remove_word_duplicates.py <language> <chapter> <topic> [--dry-run]

Example:
    python backend/scripts/remove_word_duplicates.py pt 1 2
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_word_duplicates import (  # noqa: E402
    CONTENT_DIR,
    find_duplicates,
    load_language_file,
    normalize,
    parse_key,
)


def get_topic_container(data, chapter_key, topic_key):
    chapter = data[chapter_key]
    topics = chapter["topics"] if "topics" in chapter else chapter
    return topics[topic_key]


def remove_duplicates(data, chapter_key, topic_key):
    duplicates = find_duplicates(data, chapter_key, topic_key)

    if not duplicates:
        return []

    duplicate_keys = {normalize(word) for word in duplicates}
    topic = get_topic_container(data, chapter_key, topic_key)
    words = topic["words"] if isinstance(topic, dict) else topic

    removed = [word for word in words if normalize(word) in duplicate_keys]
    kept = [word for word in words if normalize(word) not in duplicate_keys]

    if isinstance(topic, dict):
        topic["words"] = kept
    else:
        data[chapter_key][topic_key] = kept

    return removed


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("language", help="Language code, e.g. pt, en, es")
    parser.add_argument("chapter", help="Chapter key or number, e.g. 1 or chapter_1")
    parser.add_argument("topic", help="Topic key or number, e.g. 1 or topic_1")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be removed without writing the file.",
    )
    args = parser.parse_args()

    chapter_key = parse_key(args.chapter, "chapter_")
    topic_key = parse_key(args.topic, "topic_")

    data = load_language_file(args.language)
    removed = remove_duplicates(data, chapter_key, topic_key)

    if not removed:
        print(f"No duplicates to remove for {args.language} {chapter_key}.{topic_key}.")
        return 0

    print(f"Removed from {args.language} {chapter_key}.{topic_key}:")
    for word in removed:
        print(f"  '{word}'")

    if args.dry_run:
        print("(dry run — file not modified)")
        return 0

    path = CONTENT_DIR / f"{args.language}.json"
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
