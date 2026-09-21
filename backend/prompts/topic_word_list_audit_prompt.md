##########################################################################################
Topic Word List Audit — Check a Chapter/Topic's Word List Against the Two Mandatory Files

Runs: On demand, per chapter/topic — whenever I want to verify that a specific
chapter/topic's word list in backend/content/<idiom>.json actually reflects what the two
mandatory source-of-truth files say that topic should teach.

Best AI: Claude or ChatGPT — needs to read and cross-reference multiple files carefully.

Purpose: Decide whether one chapter/topic's *current* word list is complete and correct
against roadmap.md's thematic description and didactic_roadmap.md's structural/grammar
assignment for that same topic — without silently editing anything.
##########################################################################################

# Topic Word List Audit

## Inputs (fill these in before running)

- **idiom:** <e.g. pt>
- **chapter number:** <e.g. 1>
- **topic number:** <e.g. 3>

## Mandatory files (read both in full — not just a grep of the topic ID)

1. `contents/language_reading_journey_phases/roadmap.md`
2. `contents/language_reading_journey_phases/didactic_roadmap.md`

These two are the only sources of truth for what a topic is *supposed* to teach.
`roadmap.md` gives the thematic/content description; `didactic_roadmap.md` gives the
structural/grammar assignment (including any per-topic Flags already recorded there). If
the current word list conflicts with either, the word list is what's wrong — not the
mandatory files.

## Step 1 — Identify the topic

Open `backend/content/<idiom>.json` and locate `chapter_<chapter number>` /
`topic_<topic number>`. Read that object's `title` field (chapter) and `title` field
(topic) directly from the JSON — use those exact titles, not the raw numbers, to find the
matching entry in the mandatory files. Titles are the reliable cross-reference key; numeric
chapter/topic position is not guaranteed to line up 1:1 once a language pair moves past its
current level, since roadmap.md's chapter/topic numbering is level-scoped (e.g. A0-CT is
the 4th A0 chapter, but a language pair further along may have more than 7 chapters in its
JSON).

State plainly: the resolved topic ID (e.g. `A0-EL-3`), its chapter title, and its topic
title, so the rest of this audit is unambiguous.

If no chapter/topic with that number exists in the JSON, or the titles don't match
anything in roadmap.md, stop and report that as the finding — don't guess a topic to
substitute.

## Step 2 — Gather what each mandatory file actually says about this topic

- **From roadmap.md:** quote the topic's one-line description (Section 4) verbatim.
- **From didactic_roadmap.md:** find this topic's entry, if one exists, in whichever
  per-topic breakdown section covers its level (e.g. "A0 — Per-Topic Breakdown"). Quote its
  full entry verbatim, including any **Assignment** or **Flag** notes. Also check the
  level-level **Structural items** / **Thematic-adjacent items** lists earlier in the file
  for anything that names this topic by ID even outside its own per-topic entry (e.g. a
  cross-cutting decision like the connectives distribution note).
- If didactic_roadmap.md has no per-topic breakdown yet for this topic's level, say so
  explicitly — don't invent structural requirements that aren't written down anywhere.

## Step 3 — Compare against the actual word list

Read the topic's `words` array from `backend/content/<idiom>.json` in full.

For every requirement surfaced in Step 2 (a theme element from roadmap.md, a structural
item or Assignment from didactic_roadmap.md), check whether the word list actually
contains a word that satisfies it — not just a plausible-looking neighbor. Be literal: if
didactic_roadmap.md says "there is/are (`tem`/`há`)" is covered, both `tem` and `há` must
individually be present, not just one of them; if it says `um`/`uma` should be added and
only `uma` is present, that's a gap on `um`, even though the pair looks satisfied at a
glance.

## Step 4 — Gender agreement audit

Independent of what roadmap.md and didactic_roadmap.md require, check the word list itself
for internal gender consistency. This catches gaps neither mandatory file will ever
surface, because they're not about what the topic is supposed to teach — they're about
whether the forms it does include are grammatically complete (e.g. `uma`, the feminine
indefinite article, present with no masculine `um` counterpart; `pequeno` present with no
feminine `pequena`, while feminine nouns needing it are already in the same list).

- First establish how many grammatical genders the target idiom actually has. Don't assume
  two — check other words already used elsewhere in the idiom's JSON, or say "unknown,
  needs confirmation" rather than guessing. Portuguese/Spanish have two (masculine/
  feminine); some languages have three or more (e.g. German: masculine/feminine/neuter);
  some have none. A 3+-gender idiom needs every gender checked individually — a form that
  looks complete for two of three genders is still an incomplete set.
- For every word in the topic's list that carries grammatical gender (articles, most
  adjectives, and any nouns/pronouns with a paired form), check whether its counterpart
  form(s) for each of the idiom's *other* genders are present **within this topic's own
  word list**. Presence elsewhere in the idiom's JSON does not close the gap: a learner
  studying this topic needs to be able to produce a complete, grammatically correct
  expression from this topic's own vocabulary alone, without depending on having already
  studied (or later studying) an unrelated topic. This intentionally overrides
  didactic_roadmap.md's own cross-topic reuse note for `um`/`uma` (A0-EL-3) — that note is
  now considered wrong on this point and should be corrected there, not followed here.
- Apply the same discipline already established for gender-pair flags in
  didactic_roadmap.md: only flag a missing counterpart if the topic's own nouns actually
  need it. Don't flag a missing feminine form when every noun in scope is masculine (the
  non-gap precedent already recorded there for A0-NS-1/A0-NS-5's weather/sky adjectives).
- Note every gap found and every set confirmed complete — this is a distinct source of
  truth (grammatical correctness of the list against itself) from the roadmap.md/
  didactic_roadmap.md comparison in Steps 2–3, so keep it in its own report section rather
  than folding it into Missing Items.

## Step 5 — Report

Produce a markdown report with these sections:

### 1. Topic Identified
Chapter/topic titles, resolved roadmap ID, and the exact file/array checked.

### 2. Missing Items
Every requirement from roadmap.md or didactic_roadmap.md that has no matching word in the
current list. For each: the expected word/pattern, which mandatory file named it (with the
verbatim quote), and why it matters (one line).

### 3. Stale Claims in didactic_roadmap.md
Cases where didactic_roadmap.md states something is "already covered" / "no new item
needed" for this topic, but Step 3 found the actual word list doesn't back that up. Call
these out distinctly from Section 2 — they mean the mandatory file's own record is out of
date against pt.json's real state, which is worth fixing in didactic_roadmap.md too, not
only in the word list.

### 4. Gender Agreement Gaps
Findings from Step 4: the idiom's gender count (stated explicitly), each gendered word
missing a required counterpart (which gender, why the topic's nouns need it, and whether a
reusable form already exists elsewhere in the idiom's JSON), and each gendered set already
confirmed complete. State plainly if the idiom has no grammatical gender, or if none of the
topic's words carry gender — don't leave this section silently empty without saying why.

### 5. Confirmed Present
Requirements that are genuinely satisfied — brief, no need to belabor these.

### 6. Existing Flags Re-Checked
Any Flag already recorded in didactic_roadmap.md for this topic: restate it and confirm
whether it's still accurate against the JSON's current state, or whether it's already been
resolved.

### 7. Unrelated Observations (Informational Only)
Words present in the list that aren't obviously required by either mandatory file. Not a
problem by default — topics are allowed to have reasonable thematic vocabulary beyond the
bare structural minimum — but worth surfacing if something looks out of place (e.g. a word
that reads like it belongs to a different topic entirely).

### 8. Verdict
One line: **Respects both files** / **Partial — see Missing Items / Stale Claims / Gender
Agreement Gaps** / **Does not respect — see Missing Items / Stale Claims / Gender Agreement
Gaps**.

## Output Rules

- Read-only analysis. Do not edit `backend/content/<idiom>.json`, `roadmap.md`, or
  didactic_roadmap.md as part of this audit — propose the specific fix and wait for
  confirmation.
- Never invent an expected word that isn't actually implied by roadmap.md or
  didactic_roadmap.md — if a requirement is genuinely ambiguous (the mandatory file
  describes a concept but not a specific word), say so and propose 2–4 concrete candidate
  words rather than asserting one.
- Match the target idiom's actual spelling/diacritics/script as already used elsewhere in
  that idiom's JSON file — if unsure of the correct target-language form, say "unknown,"
  don't guess. This applies to gendered counterpart forms too.
- Every entry in Missing Items or Stale Claims must cite the specific mandatory-file quote
  it's based on — no unsourced claims. Gender Agreement Gaps entries don't need a
  mandatory-file quote (they're not sourced from roadmap.md/didactic_roadmap.md), but must
  state which noun(s) in the topic's own list create the need for the missing form.

## Usage Example

idiom=pt, chapter=1, topic=3 → resolves to `A0-EL-3 — At Home`, checked against
roadmap.md Section 4's "At Home" entry and didactic_roadmap.md's `A0-EL-3` per-topic
breakdown entry, against `backend/content/pt.json`'s `chapter_1.topics.topic_3.words`.
