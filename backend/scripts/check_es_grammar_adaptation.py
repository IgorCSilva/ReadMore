"""Checks the two Spanish grammar-adaptation rules called out in
steps_to_introduce_content.md's "Add mixed sentences" step against a
chapter/topic's mixed_sentences.json (backend/content/<native>-es/
chapter_N/topic_M/mixed_sentences.json) -- these are grammar rules, not a
relations.json lookup, so check_mixed_sentences_relations.py can't verify
them (it would happily accept "**e**" as a correct value for the "e"
relations key, since "e" -> "y" is the only mapping in relations.json and
the adaptation step's whole point is that the real Spanish rule sometimes
overrides that literal value).

1. y/e: Spanish "y" (and) becomes "e" only immediately before a word
   starting with an i- or hi- sound -- never anywhere else. The common
   mistake is the opposite: defaulting to "e" and never using "y" at all.

2. la/el: the feminine article "la" becomes "el" immediately before a
   stressed-a feminine noun (agua, hacha, alma, hambre, águila, ...) --
   using plain "la" there is a classic, very recognizable Spanish mistake.
   This check only has a small, explicit list of such nouns to test
   against (_STRESSED_A_FEMININE_NOUNS below); it can't recognize one
   that isn't on that list, so a clean run doesn't guarantee there's no
   stressed-a noun left unhandled, only that none of the known ones are.

Both checks only look at the word immediately following the bolded "y"/
"e" or "la" -- a dash, comma, or other bolded span in between would block
a legitimate rule application in real prose, but none of this app's
mixed_sentences so far separate a conjunction/article from its target word
that way, so this keeps the check simple rather than handling a case that
hasn't come up.

Usage:
    python backend/scripts/check_es_grammar_adaptation.py <native>-es <chapter> <topic>

Example:
    python backend/scripts/check_es_grammar_adaptation.py pt-es 3 1
"""

import argparse
import json
import re
import sys
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent.parent / "content"

BOLD_FIND = re.compile(r"\*\*(.+?)\*\*")

# Not exhaustive -- see module docstring. Covers the common classroom
# examples; extend if a new one shows up in taught vocabulary.
_STRESSED_A_FEMININE_NOUNS = {
    "agua", "águila", "alma", "ancla", "arma", "aula", "hacha", "hambre", "habla", "área",
}


def load_json(path):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def load_mixed_sentences(native, chapter, topic):
    path = CONTENT_DIR / f"{native}-es" / f"chapter_{chapter}" / f"topic_{topic}" / "mixed_sentences.json"
    if not path.exists():
        raise SystemExit(f"chapter {chapter} topic {topic} not found for '{native}-es'")
    return load_json(path)


def next_word_after(content, match_end):
    rest = content[match_end:]
    found = re.search(r"[a-zA-ZÀ-ÿ]+", rest)
    return found.group(0) if found else None


def check(native, chapter, topic):
    sentences = load_mixed_sentences(native, chapter, topic)
    problems = []

    for sentence in sentences:
        content = sentence["content"]

        for match in BOLD_FIND.finditer(content):
            bolded = match.group(1).lower()
            next_word = next_word_after(content, match.end())
            if next_word is None:
                continue
            next_lower = next_word.lower()

            if bolded in ("y", "e"):
                needs_e = next_lower.startswith("i") or next_lower.startswith("hi")
                correct = "e" if needs_e else "y"
                if bolded != correct:
                    problems.append((sentence["sentence_number"], content, f"'{bolded}' before '{next_word}' should be '{correct}' (y/e rule)"))

            elif bolded in ("la", "el"):
                needs_el = next_lower in _STRESSED_A_FEMININE_NOUNS
                if needs_el and bolded != "el":
                    problems.append((sentence["sentence_number"], content, f"'{bolded}' before stressed-a noun '{next_word}' should be 'el' (la/el rule)"))

    return problems


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pair", help="content pair, e.g. pt-es (target must be es)")
    parser.add_argument("chapter", type=int)
    parser.add_argument("topic", type=int)
    args = parser.parse_args()

    native, target = args.pair.split("-", 1)
    if target != "es":
        parser.error("this script only checks Spanish (es) grammar adaptation")

    problems = check(native, args.chapter, args.topic)

    if not problems:
        print(f"No y/e or la/el grammar mistakes found in {args.pair} chapter {args.chapter} topic {args.topic}.")
        return 0

    for number, content, reason in problems:
        print(f"sentence {number}: {reason}")
        print(f"    {content}")

    print(f"\n{len(problems)} grammar mistake(s) found.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
