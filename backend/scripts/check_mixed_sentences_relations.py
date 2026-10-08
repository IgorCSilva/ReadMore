"""Finds two kinds of mistakes in a chapter/topic's mixed_sentences.json
(backend/content/<native>-<target>/chapter_N/topic_M/mixed_sentences.json)
against the FULL backend/content/relations/<native>-<target>-relations.json
(every chapter/topic, not just this one -- that's the house rule these
sentences are built under):

1. A native-language word left unbolded in the prose even though it has a
   mapped target-language equivalent somewhere in relations.json -- the
   sentence should have replaced it with the bolded target word instead.

2. A **bolded** span whose content is actually the native word (a
   relations.json KEY) rather than its target-language translation (one of
   that key's VALUES) -- e.g. "**ninguém**" left bolded as the Portuguese
   word itself instead of being swapped for "**nadie**" first. This slips
   through easily because the bolded text still *looks* right (it's
   genuinely taught vocabulary, just in the wrong language) and the author
   only forgot the translation step, not the bolding step.

Both checks are driven by the same flattened relations map, so a key with
several recorded values (e.g. "a" meaning the article -> "la" in one
chapter but the preposition -> "a" in another) is treated as correct if the
bolded/left-over text matches ANY of them -- this is what keeps identical-
spelling pairs (such pt "de" -> es "de") from being flagged as false
positives in check #2.

Known gap: this script can only catch a native word that's an explicit KEY
in relations.json. A concept that's taught as a target word but whose
native equivalent was never recorded as its own relations key (e.g. "onde"
is taught in a later pt chapter/topic, but relations.json only ever
recorded the compound "onde fica" -> "dónde está", never bare "onde" ->
"dónde") won't be found by this script -- that's a relations.json coverage
gap, not something a lookup-table check can discover on its own. Fix those
by hand when you spot them, and consider adding the missing key to
relations.json under whichever chapter/topic actually teaches that native
word, so it's covered automatically from then on.

A handful of native words are deliberately excluded from check #1 and
reported as a softer "review" note instead of a hard error, because the
same spelling maps to more than one taught sense and only one of them is
the relations.json entry -- "que"/"como" are only mapped in their
interrogative sense (qué/cómo), not as the far more common relative
pronoun/comparative "que"/"como"; "se" is only mapped in its reflexive
sense, not conditional "if"; "um"/"a" are genuinely dual-sense (article vs.
number, article vs. preposition) and need the actual sentence read to tell
which applies. Judge each "review" hit by hand; don't bulk-replace them.

Usage:
    python backend/scripts/check_mixed_sentences_relations.py <native>-<target> <chapter> <topic>

Example:
    python backend/scripts/check_mixed_sentences_relations.py pt-es 3 1
"""

import argparse
import json
import re
import sys
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"
WORDS_DIR = Path(__file__).resolve().parent.parent / "words"

_LETTERS = "a-zA-ZÀ-ÿ"
BOLD_SPLIT = re.compile(r"(\*\*.+?\*\*)")

# Same spelling taught in more than one sense, only one of which is this
# relations.json entry -- flagged softly instead of as a hard error.
SENSE_RESTRICTED = {"que", "como", "se", "um", "a"}


def load_json(path):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def load_relations(native, target):
    path = CONTENT_DIR / "relations" / f"{native}-{target}-relations.json"
    if not path.exists():
        raise SystemExit(f"No relations file found: {path}")

    flat = {}
    for _chapter, topics in load_json(path).items():
        for _topic, langs in topics.items():
            for key, value in langs[native].items():
                values = value if isinstance(value, list) else [value]
                flat.setdefault(key.lower(), set()).update(v.lower() for v in values)
    return flat


def load_target_vocabulary(target):
    path = WORDS_DIR / f"{target}_words.json"
    if not path.exists():
        raise SystemExit(f"No target vocabulary file found: {path}")
    return {row["word"].lower() for row in load_json(path)}


def load_mixed_sentences(native, target, chapter, topic):
    path = CONTENT_DIR / f"{native}-{target}" / f"chapter_{chapter}" / f"topic_{topic}" / "mixed_sentences.json"
    if not path.exists():
        raise SystemExit(f"chapter {chapter} topic {topic} not found for '{native}-{target}'")
    return load_json(path)


def find_unbolded_leaks(plain_text, relations):
    """Longest-phrase-first scan of the UNBOLDED portions of a sentence for
    any relations.json key appearing as a whole word/phrase."""
    hits = []
    padded = f" {plain_text.lower()} "
    consumed = [False] * len(padded)
    for key in sorted(relations.keys(), key=len, reverse=True):
        pattern = re.compile(rf"(?<![{_LETTERS}]){re.escape(key)}(?![{_LETTERS}])", re.IGNORECASE)
        for match in pattern.finditer(padded):
            span = range(match.start(), match.end())
            if any(consumed[i] for i in span):
                continue
            for i in span:
                consumed[i] = True
            hits.append(key)
    return hits


def check(native, target, chapter, topic):
    relations = load_relations(native, target)
    target_vocab = load_target_vocabulary(target)
    sentences = load_mixed_sentences(native, target, chapter, topic)

    errors = []
    reviews = []

    for sentence in sentences:
        content = sentence["content"]
        parts = BOLD_SPLIT.split(content)

        for index, part in enumerate(parts):
            if index % 2 == 0:
                # plain-text span -- check #1
                leaks = find_unbolded_leaks(part, relations)
                for key in leaks:
                    entry = (sentence["sentence_number"], content, key, sorted(relations[key]))
                    (reviews if key in SENSE_RESTRICTED else errors).append(("unbolded", *entry))
                continue

            # bolded span -- check #2
            bolded = part.strip("*").lower()
            if bolded in target_vocab or any(bolded in values for values in relations.values()):
                continue
            if bolded in relations:
                errors.append(("mistranslated", sentence["sentence_number"], content, bolded, sorted(relations[bolded])))
            else:
                reviews.append(("unrecognized", sentence["sentence_number"], content, bolded, []))

    return errors, reviews


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pair", help="content pair, e.g. pt-es")
    parser.add_argument("chapter", type=int)
    parser.add_argument("topic", type=int)
    args = parser.parse_args()

    native, target = args.pair.split("-", 1)
    errors, reviews = check(native, target, args.chapter, args.topic)

    if reviews:
        print(f"{len(reviews)} item(s) need a human sense-check (not auto-flagged as errors):\n")
        for kind, number, content, word, values in reviews:
            tag = f"'{word}' -> {sorted(values)}" if values else f"'{word}'"
            print(f"  [{kind}] sentence {number}: {tag}\n    {content}")
        print()

    if not errors:
        print(f"No relations errors found in {args.pair} chapter {args.chapter} topic {args.topic}.")
        return 0

    for kind, number, content, word, values in errors:
        if kind == "unbolded":
            print(f"sentence {number}: unbolded '{word}' has target equivalent(s) {values}")
        elif kind == "mistranslated":
            print(f"sentence {number}: bolded '{word}' is the native word, not translated -- should be {values}")
        print(f"    {content}")

    print(f"\n{len(errors)} error(s) found.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
