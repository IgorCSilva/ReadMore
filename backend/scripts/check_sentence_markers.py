"""Finds taught target-language words/particles that leaked outside a
**bold** marker in a chapter/topic's sentences, e.g. "**저**는" where the
particle "는" should have been its own "**는**" segment (see pt-ko.json
sentence_number 8: "**당신****이랑** **저**는 ..." left "는" unmarked), or a
whole word inserted without markers at all (e.g. "para 안녕히 가세요
dormir" instead of "para **안녕히 가세요** dormir", or "마리나예요" instead
of "마리나**예요**").

"Taught" means: any word_id listed on a topic at or before the given
chapter/topic (same cumulative-learning rule as
backend/scripts/text_fix.py's get_learned_words). Words not taught yet
(names, untaught grammar) are ignored on purpose — only vocabulary the
learner already knows must always be marked.

Word-boundary rules vary by target language: space-delimited languages
(es, en, ...) can rely on a plain \\b/\\b anchor, same as
backend/app/domain/text_boundaries.py uses for correction matching.
Korean glues particles/endings onto the *preceding* syllable with no
space on either side (e.g. name + "예요" -> "마리나예요"), so neither side
can be anchored — text_boundaries.py's Korean strategy only anchors the
left edge, which is right for finding a host word followed by a glued
particle, but wrong here since the thing we're searching for can itself
be that glued particle. So this script keeps its own small
per-language strategy table rather than reusing that one; unanchored
matches are deduplicated by preferring the longest taught word covering
a given span (see find_unmarked_words), so a short word (e.g. "저") never
gets separately reported inside a longer taught word (e.g. "저녁") that
already covers it.

Detection is only reliable for target languages whose script doesn't
overlap with the Portuguese prose around it (Korean's Hangul never reads
as Portuguese by accident). A Latin-script target (es, en) shares its
alphabet with that prose, so a bare "de" or "tarde" left in a sentence
could be genuine Portuguese *or* an unmarked target word — text alone
can't tell them apart (both spellings are real words in both languages),
so those pairs are reported as unsupported rather than flooding the
output with guesses. See _RELIABLE_LANGUAGES below.

Usage: python backend/scripts/check_sentence_markers.py pt-ko 1 1
"""

import argparse
import json
import re
import sys
from pathlib import Path

CONTENT_DIR = Path("backend/content")
WORDS_DIR = Path("backend/words")

BOLD_SPLIT = re.compile(r"(\*\*.*?\*\*)")

# No-space languages where a taught word/particle can glue directly onto
# the surrounding text with no boundary character on either side.
_NO_SPACE_LANGUAGES = {"ko"}

# Target languages whose script never coincides with the (Portuguese)
# prose around it, so a bare occurrence of a taught word is unambiguously
# an unmarked target word rather than a same-spelled origin-language word.
# Add a target here only once its script is confirmed distinct — a
# Latin-script target sharing homographs with the origin language (es,
# en, ...) would just produce false positives.
_RELIABLE_LANGUAGES = {"ko"}


def word_pattern(word, target_lang):
    escaped = re.escape(word)

    if target_lang in _NO_SPACE_LANGUAGES:
        return re.compile(escaped)

    return re.compile(rf"\b{escaped}\b")


def load_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def target_language(pair):
    return pair.split("-")[1]


def get_learned_word_ids(data, current_chapter, current_topic):
    learned = set()

    for chapter in data["chapters"]:
        c_number = chapter["number"]

        if c_number > current_chapter:
            continue

        for topic in chapter["topics"]:
            t_number = topic["number"]

            if c_number == current_chapter and t_number > current_topic:
                continue

            learned.update(topic.get("word_ids", []))

    return learned


def get_topic_sentences(data, current_chapter, current_topic):
    for chapter in data["chapters"]:
        if chapter["number"] != current_chapter:
            continue

        for topic in chapter["topics"]:
            if topic["number"] != current_topic:
                continue

            return topic.get("sentences", [])

    raise ValueError(f"chapter {current_chapter} topic {current_topic} not found")


def get_learned_words(words_data, learned_word_ids):
    words = {
        word["word"]
        for word in words_data
        if word["word_id"] in learned_word_ids
    }
    # Longest first, so a short word (e.g. "저") never masks a shorter
    # match reported inside a longer unmarked word (e.g. "저녁") that was
    # already accounted for.
    return sorted(words, key=len, reverse=True)


def find_unmarked_words(content, learned_words, target_lang):
    offenders = []
    claimed = []

    for index, segment in enumerate(BOLD_SPLIT.split(content)):
        # Even indices are the text between bold spans; odd indices are
        # the **...** spans themselves.
        if index % 2 == 1:
            continue

        for word in learned_words:
            pattern = word_pattern(word, target_lang)

            for match in pattern.finditer(segment):
                span = match.span()

                if any(start < span[1] and span[0] < end for start, end in claimed):
                    continue

                claimed.append(span)
                offenders.append(word)

    return offenders


class UnreliableLanguage(Exception):
    pass


def check(pair, chapter, topic):
    target_lang = target_language(pair)

    if target_lang not in _RELIABLE_LANGUAGES:
        raise UnreliableLanguage(
            f"'{target_lang}' shares the Latin alphabet with the origin-language "
            "prose, so a bare occurrence of a taught word can't be reliably told "
            "apart from a same-spelled origin-language word. Only "
            f"{sorted(_RELIABLE_LANGUAGES)} are supported for now."
        )

    content_data = load_json(CONTENT_DIR / f"{pair}.json")
    words_data = load_json(WORDS_DIR / f"{target_lang}_words.json")

    learned_word_ids = get_learned_word_ids(content_data, chapter, topic)
    learned_words = get_learned_words(words_data, learned_word_ids)
    sentences = get_topic_sentences(content_data, chapter, topic)

    problems = []

    for sentence in sentences:
        content = sentence.get("content", "")
        offenders = find_unmarked_words(content, learned_words, target_lang)

        if offenders:
            problems.append({
                "sentence_number": sentence.get("sentence_number"),
                "content": content,
                "unmarked": offenders,
            })

    return problems


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("pair", help="content pair, e.g. pt-ko")
    parser.add_argument("chapter", type=int)
    parser.add_argument("topic", type=int)
    args = parser.parse_args()

    try:
        problems = check(args.pair, args.chapter, args.topic)
    except UnreliableLanguage as error:
        print(error)
        sys.exit(0)

    if not problems:
        print(f"No unmarked words found in {args.pair} ch {args.chapter} topic {args.topic}.")
        sys.exit(0)

    for problem in problems:
        print(f"sentence {problem['sentence_number']}")
        print(f"  content: {problem['content']}")
        print(f"  unmarked: {', '.join(problem['unmarked'])}")
        print()

    print(f"{len(problems)} sentence(s) with unmarked words.")
    sys.exit(1)
