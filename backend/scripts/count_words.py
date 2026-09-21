"""Count words in backend/content/<language>.json across a chapter/topic
range, inclusive, following chapter/topic order (not file order).

Usage:
    python backend/scripts/count_words.py <language> <start_chapter> <start_topic> <end_chapter> <end_topic>

Example:
    python backend/scripts/count_words.py pt 1 1 2 4
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from check_word_duplicates import iter_topics, load_language_file, parse_key  # noqa: E402


def key_number(key, prefix):
    return int(key[len(prefix):])


def position(chapter_key, topic_key):
    return key_number(chapter_key, "chapter_"), key_number(topic_key, "topic_")


def count_words(data, start_chapter, start_topic, end_chapter, end_topic):
    start = position(start_chapter, start_topic)
    end = position(end_chapter, end_topic)

    if start > end:
        raise SystemExit(
            f"Start ({start_chapter}.{start_topic}) comes after end ({end_chapter}.{end_topic})."
        )

    all_positions = set()
    breakdown = []

    for c_key, t_key, words in iter_topics(data):
        pos = position(c_key, t_key)
        all_positions.add(pos)

        if start <= pos <= end:
            breakdown.append((pos, c_key, t_key, len(words)))

    if start not in all_positions:
        raise SystemExit(f"Topic '{start_topic}' not found in chapter '{start_chapter}'.")

    if end not in all_positions:
        raise SystemExit(f"Topic '{end_topic}' not found in chapter '{end_chapter}'.")

    breakdown.sort(key=lambda item: item[0])
    total = sum(count for _, _, _, count in breakdown)

    return total, breakdown


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("language", help="Language code, e.g. pt, en, es")
    parser.add_argument("start_chapter", help="Starting chapter key or number, e.g. 1 or chapter_1")
    parser.add_argument("start_topic", help="Starting topic key or number, e.g. 1 or topic_1")
    parser.add_argument("end_chapter", help="Ending chapter key or number, e.g. 2 or chapter_2")
    parser.add_argument("end_topic", help="Ending topic key or number, e.g. 4 or topic_4")
    args = parser.parse_args()

    start_chapter = parse_key(args.start_chapter, "chapter_")
    start_topic = parse_key(args.start_topic, "topic_")
    end_chapter = parse_key(args.end_chapter, "chapter_")
    end_topic = parse_key(args.end_topic, "topic_")

    data = load_language_file(args.language)
    total, breakdown = count_words(data, start_chapter, start_topic, end_chapter, end_topic)

    for _, c_key, t_key, count in breakdown:
        print(f"  {c_key}.{t_key}: {count}")

    print(
        f"Total ({args.language} {start_chapter}.{start_topic} .. "
        f"{end_chapter}.{end_topic}): {total}"
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
