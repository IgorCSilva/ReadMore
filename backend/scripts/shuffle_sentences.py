"""Shuffle a topic's sentence contents in backend/content/<pair>.json.

Only the `content` strings are shuffled among each other; each entry keeps
its original `sentence_number` (and therefore its position in the list) —
so the sentence numbering stays 1..N in order, just with different text
behind each number.

Usage:
    python backend/scripts/shuffle_sentences.py <pair> <chapter> <topic> [--seed N] [--dry-run]

Example:
    python backend/scripts/shuffle_sentences.py pt-es 1 1
"""

import argparse
import json
import random
import sys
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"


def load_pair_file(pair):
    path = CONTENT_DIR / f"{pair}.json"

    if not path.exists():
        raise SystemExit(f"No content file found for pair '{pair}': {path}")

    with open(path, encoding="utf-8") as file:
        return json.load(file)


def find_topic(data, chapter_number, topic_number):
    chapter = next((c for c in data.get("chapters", []) if c.get("number") == chapter_number), None)
    if chapter is None:
        raise SystemExit(f"Chapter {chapter_number} not found.")

    topic = next((t for t in chapter.get("topics", []) if t.get("number") == topic_number), None)
    if topic is None:
        raise SystemExit(f"Topic {topic_number} not found in chapter {chapter_number}.")

    return topic


def shuffle_sentences(topic, seed=None):
    """Shuffles topic["sentences"][*]["content"] in place, keeping each
    entry's sentence_number (and list position) unchanged. Returns the
    sentences list for convenience."""
    sentences = topic.get("sentences", [])
    if len(sentences) < 2:
        return sentences

    contents = [s["content"] for s in sentences]
    random.Random(seed).shuffle(contents)
    for sentence, content in zip(sentences, contents):
        sentence["content"] = content

    return sentences


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pair", help="Language pair content file stem, e.g. pt-es, pt-en")
    parser.add_argument("chapter", type=int, help="Chapter number, e.g. 1")
    parser.add_argument("topic", type=int, help="Topic number, e.g. 1")
    parser.add_argument("--seed", type=int, default=None, help="Random seed, for a reproducible shuffle")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show the shuffled sentences without writing the file.",
    )
    args = parser.parse_args()

    data = load_pair_file(args.pair)
    topic = find_topic(data, args.chapter, args.topic)
    sentences = shuffle_sentences(topic, seed=args.seed)

    if not sentences:
        print(f"No sentences to shuffle for {args.pair} chapter {args.chapter} topic {args.topic}.")
        return 0

    print(f"Shuffled {len(sentences)} sentence(s) for {args.pair} chapter {args.chapter} topic {args.topic}:")
    for sentence in sentences:
        print(f"  {sentence['sentence_number']}. {sentence['content']}")

    if args.dry_run:
        print("(dry run — file not modified)")
        return 0

    path = CONTENT_DIR / f"{args.pair}.json"
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
