##########################################################################################
ReadMore Adaptation — Words

Runs: Per topic — whenever a topic's target-language word list has been authored (see
backend/content/<target>.json, e.g. es.json's chapter_N/topic_N word arrays, produced by
the tmp_prompt.md-style generation pass and cleaned up via backend/scripts/
check_word_duplicates.py / remove_word_duplicates.py) and needs to be brought into the
ReadMore application. Not a numbered phase in the 00–09 curriculum sequence; a
content-adaptation pass, like ../migration_update_existing_files.md, but recurring per
topic rather than a one-time reconciliation.

Best AI: Claude — needs to read/write JSON precisely across six separate files, check the
images/ directory on disk, translate/match words between two languages with judgment
(not just transcription), and reason about a live per-user Google Sheet without
corrupting it.

Purpose: Take one chapter/topic's already-authored target-language word list and turn it
into everything the ReadMore app (this repository) needs to actually teach those words: the
origin-target relations data, the pair's word_ids linkage in content/<pair>.json, a shared
catalog.json word entry, its sentence/cue content, and a checklist of any word images still
missing on disk. Nothing here writes texts or exercises — adapting a topic's texts is
phase_texts_adaptation.md, and adapting a topic's exercises is
phase_exercises_adaptation.md (both sibling phases in this same folder; each depends on
this phase having already run for the topic first).
##########################################################################################

# ReadMore Adaptation — Words

You are adapting one chapter/topic's already-authored target-language word list into the
ReadMore application so it can actually be studied there. The input is three things:

1. **The origin-target language pair** — e.g. `pt-es` (origin `pt`, target `es`). Always
   ask me for this before doing anything else if I haven't stated it when invoking this
   phase; never assume one pair over another just because it's the one most recently
   worked on.
2. **A chapter and topic** — plain numbers (or `chapter_N`/`topic_N` keys), matching the
   same numbering convention already used by `backend/scripts/check_word_duplicates.py`,
   `remove_word_duplicates.py`, and `count_words.py`. Ask if not stated.
3. **The target word list itself** — not given to me directly; read it from
   `backend/content/<target>.json` at `chapter_<N>` → (`topics` →) `topic_<M>` →
   `words` (that file may use either the nested `{"title", "topics": {...}}` shape or the
   flat `{"topic_N": [...]}` shape — handle both, same as the scripts above do).

Read every file this phase touches, in full, before making any change. They live under
`backend/` (confirm this still matches — if the app's schema has changed since this phase
was written, stop and tell me rather than guessing a new one):

```
backend/content/<target>.json — this run's source word list (see input #3 above). Read-
                                 only for this phase; never edit it here.

backend/content/<origin>.json — the origin language's own per-chapter/topic word lists
                                 (e.g. pt.json). Read-only. Used in Section 3.1 to find
                                 each target word's natural origin-language equivalent —
                                 these lists were authored to be conceptually aligned per
                                 topic with the target list, though not always 1:1 by
                                 position or count (a topic's word budget can collapse or
                                 split across languages), so match by MEANING, not index.

backend/content/relations/<origin>-<target>-relations.json — the origin-target word
                                 equivalence map this phase writes to in Section 3.1, e.g.
                                 relations/pt-es-relations.json:
  {"chapter_N": {"topic_M": {"<origin-code>": {"<origin word>": "<target word>", ...}}}}
  A value can be a plain string, or a list of strings when more than one target word is
  an accepted equivalent for the same origin word (e.g. "tchau": ["chao", "adiós"]).
  Multiple different origin keys mapping to the same target value is normal, not a
  duplicate (e.g. "obrigado" and "obrigada" both → "gracias").

backend/content/<pair>.json   — this pair's curriculum, unrelated pairs untouched, e.g.
                                 pt-es.json — the file Section 3.2 writes to:
  {"chapters": [{chapter_id, number, title, description, status, topics: [
    {topic_id, number, title, description, status, word_ids: [...], texts: [...], exercises: [...]}
  ]}]}
  A topic's `word_ids` here holds the TARGET language's own per-language ids
  from <target>_words.json (e.g. "es-wd-0001"), not catalog.json's word_id
  directly — see Section 6. `exercises[].items[].word_ids` and
  `exercises[].word_bank` are a separate, untouched concern (this phase never
  writes exercises) and keep using catalog.json's word_id directly.

backend/words/catalog.json    — the shared words catalog, ONE row per concept, language-
                                 agnostic:
  {"words": [{word_id, filename}, ...]}
  Nothing else lives on a catalog.json row — no spelling, no target-language
  code. filename is always an English slug (see Section 5) even for a concept
  that has no English spelling anywhere in the app (e.g. Spanish's reflexive
  "llamarse" machinery) — write an English descriptive gloss of the concept in
  that case, never the foreign-language word itself.

backend/words/<target>_words.json  — one file per target language (e.g. en_words.json,
                                 es_words.json), the join between catalog.json and this
                                 target's actual spellings:
  [{word_id, root_word_id, word}, ...]
  `word_id` here is sequential PER LANGUAGE ("<target>-wd-0001", "<target>-
  wd-0002", ...), assigned in this file's own append order — never renumbered
  or reused, same stability rule as catalog.json's word_id (see "Do not").
  `root_word_id` is the join key back to catalog.json's word_id (never this
  file's own word_id). `word` is this target language's actual spelling. A
  concept with no spelling in a given target language simply has no row in
  that language's file, rather than an empty one.

backend/words/sentences.json  — flat, every pair's sentences in one file:
backend/words/cues.json         {"<lang-code>_<root_word_id>": "<text>", ...}
  lang-code is either the pair's origin code or target code (e.g. "pt"/"es" for
  pt-es); root_word_id is catalog.json's word_id (never a <target>_words.json
  id) — this is what lets the same catalog word resolve a sentence/cue in
  either language. This phase always writes the TARGET-language sentence
  (<target-code>_<root_word_id>) and the ORIGIN-language cue
  (<origin-code>_<root_word_id>) for a new word — the reverse pair (an
  origin-language sentence, a target-language cue) is optional follow-up
  content, not something a normal single-topic run needs to author; note its
  absence in the report rather than blocking on it.
```

`status` is `"ready"` or `"in_development"` — a chapter/topic still shows in its list
either way, but `"in_development"` renders disabled (faded, unclickable) until it's ready
for real use.

## Do not

Do not renumber, reuse, or otherwise change any existing `word_id`. This is the single
most important rule in this phase. `word_id` is a stable foreign key that a live Google
Sheet (per-user flashcard progress, one row per `(email, lang, word_id)`) references by
value — an earlier session in this project's history renumbered the whole word list for
a reordering task and had to write a one-off Apps Script migration action just to fix
every affected user's progress row afterward. `word_id` is also global now, shared across
every pair — new words always get a brand-new id past the catalog's current overall
maximum (not per-pair), and never touch an id that already exists for any pair.

Do not invent an origin-language equivalent for Section 3.1 without checking
`<origin>.json`'s same chapter/topic first. If nothing there fits, or more than one
candidate plausibly fits, ask me — 2–4 concrete options with a one-line tradeoff each,
same as every other phase in this workflow — rather than guessing a translation.

Do not silently overwrite an existing relations-file mapping. If an origin word already
has a recorded target equivalent and this run finds a different one, turn the value into
a list (per the schema above) instead of replacing it.

Do not fabricate an image. If no image file exists for a word, say so in the report as
something for me to source — never invent a placeholder or silently leave a word without
noting the gap.

Do not write or edit any `texts` or `exercises` array. This phase only ever touches
`relations/<pair>-relations.json`, catalog.json's `words` array, sentences.json,
cues.json, and the pair's chapter/topic shell + `word_ids` list inside
`content/<pair>.json`.

Do not invent a chapter/topic description, title translation, or word cue you can't
actually derive from the global roadmap (`contents/language_reading_journey_phases/
roadmap.md`), the app's existing house style (see below), or my direct answer to a
question you asked me. If something is genuinely ambiguous, ask.

Do not assume a same-spelling check catches every duplicate once more than one target
language exists. Two target languages never share spellings for the same concept (English
"hello" and Spanish "hola" are different strings) — a same-string dedup only ever catches
a duplicate within the *same* target language's `<target>_words.json`. If this run's
target isn't English and a word's underlying concept plausibly already has a catalog.json
row from a different target language (matching image/concept, not matching spelling), ask
me whether to reuse that row (adding a new row to this run's `<target>_words.json`,
`root_word_id` pointing at it) instead of creating a new catalog.json row — never merge
two catalog.json rows into one, or split one, without being reasonably confident they're
the same concept.

## Produce

### 1. Confirm the Inputs

This is always the first thing you do when this phase is invoked — before reading any
file. If I stated the origin-target pair, chapter, and topic when invoking this phase, use
them. For anything I didn't state, stop and ask before reading anything further —
concrete questions ("What's the origin-target pair for this run, e.g. pt-es?", "Which
chapter and topic?"), never an assumption.

The pair, chapter, and topic are all you need to derive every file path this phase reads
or writes — never ask me for a file path directly. Given `pair: pt-es`, `chapter: 1`,
`topic: 1`, for example: origin `pt`, target `es` →
`backend/content/es.json`'s `chapter_1`/`topic_1` is this run's word list,
`backend/content/relations/pt-es-relations.json` is where Section 3.1 writes, and
`backend/content/pt-es.json` is where Section 3.2 writes. Every other file path in this
phase (catalog.json, `<target>_words.json`, sentences.json, cues.json, `<origin>.json`)
follows the same `<origin>`/`<target>` substitution.

Once the pair and chapter/topic are known, read the target word list from
`backend/content/<target>.json` (input #3 above) and the origin word list for the same
chapter/topic from `backend/content/<origin>.json`, if present. If the target list is
missing, empty, or looks obviously wrong (garbled entries, wildly outside the expected
20–30 range these lists are normally authored to), say so and stop rather than adapting
something broken.

### 2. Locate the Target Chapter/Topic in content/<pair>.json

Consult the global roadmap (`contents/language_reading_journey_phases/roadmap.md`,
Section 3/4) to translate this run's plain `chapter_N`/`topic_M` numbers into the
roadmap's own chapter/topic codes and titles — e.g. `chapter_1`/`topic_2` → `A0-EL` /
`A0-EL-2 — Family & People Around Me`. `backend/content/<origin>.json`'s own
chapter/topic order (the order its chapters were authored in) is the concrete mapping of
number → roadmap chapter; confirm it if in doubt rather than assuming chapter_1 is always
A0-EL for every pair.

Map that to `content/<pair>.json`'s id convention, matching however that pair's existing
chapters/topics are already named (check first — don't assume a format not already in
use): typically `chapter_id: "ch-<chapter-code>"` and `topic_id: "top-<topic-code>"`, e.g.
chapter `A0-EL` → `ch-A0-EL`, topic `A0-EL-2` → `top-A0-EL-2`.

- **If the chapter doesn't exist yet:** create it, with `number` continuing that pair's
  existing chapter sequence, `title`/`description` drawn from the roadmap (translate to
  the app's display language if the roadmap's own text isn't already in that language —
  check how existing chapters/topics are titled and match that), and
  `status: "in_development"` (it has no ready texts/exercises yet).
- **If the chapter exists but the topic doesn't:** append the new topic to that
  chapter's `topics` array the same way, `number` continuing that chapter's own
  sequence, `status: "in_development"`.
- **If the topic already exists:** leave its `title`/`description`/`status` untouched
  — you're only adding to its `word_ids`, not redefining it. Don't flip an existing
  `"ready"` topic back to `"in_development"` just because you're adding words to it.

### 3. Build the Relations Data and the Pair Content File

#### 3.1 Build the Origin-Target Relations Data

For every word in this run's target word list, in the list's own order:

- Find its origin-language equivalent by checking `<origin>.json`'s SAME chapter/topic
  word list for a natural match — same concept, plain translation. Match by meaning, not
  position (the two lists aren't guaranteed to line up 1:1; a concept can collapse or
  split differently across languages — see the note on this in the files list above).
- If nothing in that topic's origin list fits, or more than one candidate plausibly fits,
  ask me rather than guessing (per "Do not" above).
- Add `{"<origin word>": "<target word>"}` under
  `backend/content/relations/<origin>-<target>-relations.json`'s
  `chapter_N.topic_M.<origin-code>` object, creating that path if it doesn't exist yet.
  If the origin word already has a different recorded equivalent there, turn the value
  into a list instead of overwriting it. It's normal for several different origin words
  to map to the same target word (e.g. "obrigado"/"obrigada" both → "gracias") — that's
  not a duplicate to resolve.

#### 3.2 Create the Pair Content File

Using the same word list and the relations just built:

- For every word, resolve its `<target>_words.json` id — reuse an existing row if this
  exact spelling already exists for this target (Section 4's dedupe check), otherwise
  create new catalog.json / `<target>_words.json` / sentences.json / cues.json rows for it
  (Sections 4–6 below).
- Append every resolved id, in the word list's order, to this topic's `word_ids` array in
  `content/<pair>.json` (the chapter/topic located or created in Section 2) — appending
  after whatever's already there. Never remove or reorder an id already present.
- This step never writes `texts` or `exercises` — only the chapter/topic shell (if newly
  created in Section 2) and `word_ids`, per the "Do not" rule above.

### 4. Dedupe Against catalog.json

For every word in this run's target word list, check this run's target
`<target>_words.json` for an existing row whose `word` matches (case-insensitive,
punctuation-insensitive — same normalization `backend/scripts/check_word_duplicates.py`
uses).

- **Already present for this target:** don't create a duplicate. Use its existing
  `<target>_words.json` `word_id` for Section 3.2, and note the reuse in the report.
- **Not present for this target, but plausibly the same concept as an existing
  catalog.json row already spelled for a different target** (see "Do not" above): ask me
  before deciding whether to reuse that catalog.json row (via a new `<target>_words.json`
  row pointing at it) or create a brand-new catalog.json row.
- **Genuinely new:** continue to Section 5.

### 5. Create the New word_id Entries

For each genuinely-new word, in the word list's own order:

**If no catalog.json row represents this concept yet at all** (not just "not yet spelled
for this target" — genuinely no row for any target language), add one to catalog.json's
`words` array:

- **word_id** — next sequential id after the *whole catalog's* current maximum, across
  every target language (e.g. current max `wd-0259` → next new word is `wd-0260`, then
  `wd-0261`, ...). Compute this once per run from catalog.json's actual current state,
  not from any number remembered from a previous run.
- **filename** — always an English slug, even when this run's target language isn't
  English and the concept has no English spelling anywhere in the app. A lowercase slug
  of the word/phrase: spaces and apostrophes become underscores, everything else stays.
  E.g. `"thank you"` → `thank_you`, `"a few"` → `a_few`, `"to go"` → `to_go`. If there's
  no English word for the concept (e.g. Spanish's reflexive "llamarse" machinery has no
  1:1 English equivalent), write a short English descriptive gloss of what the word
  does/means instead — never the foreign-language spelling itself (e.g. the Spanish verb
  form "llamas" → filename `you_are_called`, not `llamas`). This is the base filename
  images/ is checked against (Section 7) — it does not include an extension.

Append every new row to catalog.json's `words` array in the word list's order, after the
existing last entry — do not insert rows elsewhere in the array.

Then, whether the catalog.json row was newly created above or an existing one being
spelled in this target for the first time, add a row to this run's target
`<target>_words.json`:

- **word_id** — next sequential id in *that target language's own file* (e.g. current max
  `es-wd-0017` → next is `es-wd-0018`). Compute this once per run from that file's actual
  current state. Never reuse or renumber an existing row's id in this file either — same
  stability rule as catalog.json's word_id.
- **root_word_id** — the catalog.json word_id this row is a spelling of (the one just
  created, or the existing one being reused across targets).
- **word** — the target word list's entry exactly as written (its own casing).

### 6. Write the Sentence and Cue

For every genuinely-new (root_word_id, target) pairing, add to sentences.json and
cues.json (both files, using the catalog.json `root_word_id`, never the
`<target>_words.json` id). Unlike the old words.md-based version of this phase, this
run's input has no pre-written example sentence or part-of-speech column — both are
authored fresh here, from the word itself and its Section 3.1 origin equivalent:

- **`"<target-code>_<root_word_id>"` in sentences.json** — a natural target-language
  sentence using the word, with the word's exact surface form in that sentence (singular,
  plural, conjugated — whatever you chose to use) replaced by `_____`. E.g.
  `"I have an apple."` → `"I have an _____."`; `"I like grapes."` → `"I like _____."`
  (the blank absorbs whatever inflection is actually there; there's no answer-checking
  in the app today, so this doesn't need to normalize to the dictionary form).
- **`"<origin-code>_<root_word_id>"` in cues.json** — one sentence in the origin
  language, in the app's existing descriptive-definition style: it describes what the
  word means or how it's used, and never just repeats the Section 3.1 translation as a
  bare word. Infer the word's part of speech yourself (no column supplies it — state your
  inference in the report if it's not obvious) and match this house style exactly — three
  worked examples pulled straight from the existing catalog:
  - "hello" (interjection, olá) → `"Uma saudação comum dita ao encontrar alguém."`
  - "please" (interjection, por favor) → `"Uma palavra educada acrescentada ao pedir
    algo."`
  - "from" (preposition, de) → `"A preposição que mostra um ponto de partida ou
    origem."`
  If a word is a concrete, picturable noun (like "apple"), the cue can instead briefly
  describe the thing itself rather than its grammatical function — match whichever of
  the two styles the closest existing entries for that part of speech use.

### 7. Check for Existing Images

For every word this run touches (new or reused), check `images/` for a file named
`<filename>.<ext>` for any of the extensions the app already tries, in this order:
`png, jpg, jpeg, webp, gif, jfif` (confirm this list is still current in the frontend
before relying on it).

- **Found:** note it in the report, nothing else to do.
- **Missing:** list it explicitly in the report as needing an image — don't create a
  placeholder file, and don't let a missing image block anything else in this phase.
  A word with no image simply falls back to the app's own "cue" button behavior at
  runtime, so this is a nice-to-have follow-up, never a blocker.

### 8. Adaptation Report

Produce a short report (in this same readmore_adaptation/ folder, e.g.
`reports/<topic-id>-words-report.md`) stating:

- which pair, chapter, and topic this run targeted, and whether the chapter/topic was
  created or already existed (Section 2);
- every origin-target relation added in Section 3.1, and any word that needed my input
  to resolve;
- every new catalog.json word_id assigned, with its filename (Section 5);
- every new `<target>_words.json` id assigned, with its root_word_id, spelling,
  sentence, and cue (Section 6), including the part-of-speech you inferred for each;
- every word reused from an existing catalog.json entry instead of duplicated (and, if
  applicable, every row reused across pairs per the "Do not" section's rule);
- every image found vs. missing (a clean checklist for me to act on);
- the topic's `word_ids` count in `content/<pair>.json` before and after this run;
- explicitly, whether this run only authored the target-sentence/origin-cue pair (the
  normal case) or also added the reverse variants.

## Output Rules

Never touch an existing `word_id`'s value — in either catalog.json or any
`<target>_words.json` — new ids only, each computed fresh per run from that specific
file's own current maximum (catalog.json's is global across all languages;
`<target>_words.json`'s is per that one language).

Never write to `texts` or `exercises` — relations, words, sentences, and cues only.

Never fabricate an image file, a chapter/topic description you can't derive from the
roadmap or my direct answer, an origin-language equivalent you can't derive from
`<origin>.json` or my direct answer, or a cue that's just the translation restated.

Never merge or split a catalog.json row across pairs without asking first, per "Do not"
above.

Never silently overwrite an existing relations-file mapping — turn it into a list instead.

State plainly when something doesn't fit an existing convention (id format, filename
slug collision with a different existing word, house style for a cue) rather than
guessing past it.

After the files are updated, remind me explicitly: these words have no per-user
progress rows yet — no one will see them in Flashcards until rows are added to the
`progress` sheet tab for whichever users should get them (per-user, per-word, same as
every other word in this app). This phase does not touch the Google Sheet at all.

# Unresolved Items

Create (or continue) a file called unresolved_items/readmore_adaptation_unresolved_items.md
inside readmore_adaptation/ — one running file across every run of this phase, not one per
run. Always create it, even if empty.

This is a separate thread from the phase-numbered ones (prefix `RA-U-`, not tied to any
phase number) and from the migration thread (`M-U-`) — its own continuous list.

Give each item a short ID (RA-U-01, RA-U-02, ...), continuing to increment across every
run through this phase, and include:

- unresolved point;
- why it matters;
- affected topic (name it) or "adaptation-wide";
- decision required;
- resolution timing — one of:
  - "Now": this run's own deliverable can't be produced without it;
  - "Later — until [condition]": state the earliest known blocking point, if known;
  - "Later — not yet known";
- status: Open (resolved later by updating this field and adding the decision, never by
  deleting the original entry).

At the top of the file, before the full list, add a block called 'Must be resolved now'
listing only the IDs (one-line reference each) with a valid and an invalid example
response for each. If none, state explicitly: "None of the items below block this run's
own deliverable."

Do not resolve any item by assumption.

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
## Done when
the origin-target pair, chapter, and topic were either stated by me or confirmed by
asking — never assumed;
the target word list was read from `backend/content/<target>.json` and, where it existed,
the origin word list from `backend/content/<origin>.json`;
the target chapter/topic is confirmed in `content/<pair>.json` (created or already
present, with correct status);
every word in the target list has an origin-language equivalent recorded in
`relations/<pair>-relations.json` (Section 3.1), asked about rather than guessed wherever
ambiguous;
every word is either a new catalog.json entry with a fresh, never-before-used
(catalog-wide) word_id, or an explicitly-noted reuse of an existing one (same pair or, if
confirmed with me, a different pair's row);
every new word has a target-language sentence and an origin-language cue written to
sentences.json/cues.json;
every resolved word_id is added to the topic's word_ids in content/<pair>.json (Section
3.2), in order, nothing removed;
the images/ check ran for every word and the report lists found vs. missing plainly;
the adaptation report exists and covers all of the above;
I've been reminded that these words still need progress rows added to the Google Sheet
before any user actually sees them.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
