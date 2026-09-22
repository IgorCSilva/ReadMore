# Language Integration

How the game reads and references the existing ReadMore language data model.
This document exists specifically to protect one rule: **the game must run
against any origin→target language pair without code changes.** See
`PROJECT_ANALYSIS.md` §B/§E for the original inspection this is distilled from.

## The existing model (unchanged by the game)

```
LanguagePair ("origin-target", e.g. "pt-en", "pt-es")
  → Chapter (chapter_id, number, title, status)
      → Topic (topic_id, number, title, word_ids[], texts[], sentences[],
                phrases[], exercises[], status)
```

- `backend/words/catalog.json` — language-agnostic root words (`word_id` +
  image `filename`). Every pair's content ultimately points back to these ids.
- `backend/words/{target}_words.json` — per-**target**-language realization
  (`word_id` like `en-wd-0001`, `root_word_id`, `word` text, `gender_id`). One
  file per target language, independent of which origin(s) pair with it.
- `backend/content/{origin}-{target}.json` — one file per pair, each with its
  own independent chapter/topic tree.
- `Topic.word_ids` reference **target-language** word ids (`en-wd-0001`), not
  catalog root ids.

## The rule this file exists to enforce

**Any new game data must key off `(lang, word_id)` or `(lang, topic_id)`** —
the same keys the existing progress/topics/corrections repositories already use
— and never assume a specific origin, a specific target, or a specific pair's
chapter/topic numbering.

Concretely:

- A game-content mapping is **per topic, per pair** — because a topic's
  vocabulary and its `word_id`s are pair-specific (pt-en's `top-A0-EL-1` has
  different `word_id`s than pt-es's equivalent topic, even if the underlying
  concepts overlap via `root_word_id`).
- Mapping file location mirrors `content/{origin}-{target}.json`'s own
  convention: `game_approach/content/game-{origin}-{target}.json` (exact path
  finalized in Milestone 4), so adding a pair's game content is "add a file",
  not "change code".
- The Phaser scene, the command parser, and every backend use case take `lang`
  as a parameter and resolve everything else from it — exactly how
  `GetChapters`/`GetWords`/`_parse_lang` already work in `backend/app/main.py`.

## Game-content mapping shape (draft, refined in Milestone 4)

```json
{
  "en-wd-0001": { "role": "dialogue", "line": "greeting" },
  "en-wd-0009": { "role": "noun", "concept": "name" },
  "en-wd-0011": { "role": "dialogue", "line": "possessive-my" }
}
```

Keys are target-language `word_id`s from the topic's own `word_ids` list — the
same ids `GetWords`/`GetUserWords` already resolve to sentences/cues/images.
The game-content repository never needs to know the origin language at all;
only the target-language word id matters for gameplay role.

## Cross-pair validation gate

Before any slice is considered "done" (see `DEVELOPMENT_ROADMAP.md` step 11),
it must be re-run against a second pair's equivalent topic (not just a second
topic in the same pair) with **zero engine code changes** — only a new mapping
file. This is the concrete test for the constraint above, not just a stated
intention.

## What the game must never do

- Never embed a word's text, translation, or sentence directly in game code or
  game-content JSON — reference `word_id` and let the existing
  `CatalogRepository` resolve it, same discipline `Correction`/`ProgressRecord`
  already follow.
- Never assume "target" means a specific language (e.g. never assume target is
  always English) — `sentence_lang`/`cue_lang` already model this as a choice
  between "origin"/"target" labels, not literal language names, and the game
  must follow suit.
- Never hardcode chapter/topic numbers across pairs as if they correspond
  (pt-en chapter 1 and pt-es chapter 1 are unrelated trees).

## Status

Documented, not yet implemented. First concrete artifact is the Milestone 4
mapping file for pt-en's Greetings topic (`top-A0-EL-1`).
