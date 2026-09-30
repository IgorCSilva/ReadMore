"""Check whether a topic's word list has an item duplicated in another
chapter/topic of the same language, i.e. another backend/content/<language>/
chapter_N/topic_N/words.json file.

Usage:
    python backend/scripts/check_word_duplicates.py <language> <chapter> <topic>

Example:
    python backend/scripts/check_word_duplicates.py pt 1 2
"""

import argparse
import json
import re
import sys
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"

_PUNCTUATION_RE = re.compile(r"[^\w\s-]", flags=re.UNICODE)


def normalize(word):
    """Lowercase, trim, and drop punctuation so words that only differ by
    case or punctuation (e.g. "Olá!" vs "olá") count as the same word.
    Hyphens are kept, since compounds like "meia-noite" rely on them.
    """
    return _PUNCTUATION_RE.sub("", word).strip().lower()


def load_language_file(language):
    """Merge every backend/content/<language>/chapter_N/topic_N/words.json
    into {chapter_key: {topic_key: [words]}}, so cross-topic duplicate
    checking still sees the whole language at once."""
    lang_dir = CONTENT_DIR / language

    if not lang_dir.is_dir():
        raise SystemExit(f"No content directory found for language '{language}': {lang_dir}")

    data = {}
    for path in sorted(lang_dir.glob("chapter_*/topic_*/words.json")):
        chapter_key, topic_key = path.parent.parent.name, path.parent.name
        with open(path, encoding="utf-8") as file:
            data.setdefault(chapter_key, {})[topic_key] = json.load(file)

    return data


def iter_topics(data):
    """Yield (chapter_key, topic_key, words) for every topic in the file."""
    for chapter_key, topics in data.items():
        for topic_key, words in topics.items():
            yield chapter_key, topic_key, words


def find_duplicates(data, chapter_key, topic_key):
    target_words = None
    other_topics = []

    for c_key, t_key, words in iter_topics(data):
        if c_key == chapter_key and t_key == topic_key:
            target_words = words
        else:
            other_topics.append((c_key, t_key, words))

    if target_words is None:
        raise SystemExit(f"Topic '{topic_key}' not found in chapter '{chapter_key}'.")

    target_by_normalized = {normalize(word): word for word in target_words}

    duplicates = {}
    for c_key, t_key, words in other_topics:
        for word in words:
            normalized = normalize(word)

            if normalized in target_by_normalized:
                original = target_by_normalized[normalized]
                duplicates.setdefault(original, []).append(f"{c_key}.{t_key}")

    return duplicates


def parse_key(value, prefix):
    return value if value.startswith(prefix) else f"{prefix}{value}"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("language", help="Language code, e.g. pt, en, es")
    parser.add_argument("chapter", help="Chapter key or number, e.g. 1 or chapter_1")
    parser.add_argument("topic", help="Topic key or number, e.g. 1 or topic_1")
    args = parser.parse_args()

    chapter_key = parse_key(args.chapter, "chapter_")
    topic_key = parse_key(args.topic, "topic_")

    data = load_language_file(args.language)
    duplicates = find_duplicates(data, chapter_key, topic_key)

    if not duplicates:
        print(f"No duplicates found for {args.language} {chapter_key}.{topic_key}.")
        return 0

    print(f"Duplicates found for {args.language} {chapter_key}.{topic_key}:")
    for word, locations in duplicates.items():
        print(f"  '{word}' also in: {', '.join(locations)}")

    return 1


if __name__ == "__main__":
    sys.exit(main())
