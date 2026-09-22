# ReadMore Game — Existing Project Analysis

This document is the answer to `game_approach.md` §55 ("First Task"): an inspection
of the actual ReadMore codebase, done before any game code was written, plus the
resulting integration strategy and roadmap. Consult this before starting or
resuming game work — it reflects the state of the repo as of 2026-09-22.

> **Hard constraint carried through every section below**: the game must work for
> **any** origin→target language pair the catalog defines (`pt-en`, `pt-es`, and
> whatever is added later) — never hard-coded to one pair. Nothing here should be
> read as "build it for pt-en"; every reference to a language pair is an example.

---

## A. Existing architecture

- **Backend**: Python/FastAPI, Clean Architecture (`domain` → `application` →
  `infrastructure`), composition root in `backend/app/main.py`. Local dev runs via
  Docker Compose (`uvicorn --reload`); production is a single service serving the
  built Vue app plus the API.
- **Frontend**: Vue 3 + TypeScript + Vite. No router, no React/Next, no Tailwind —
  hash-based navigation lives inside one large `frontend/src/App.vue`, with small
  per-feature Vue components under `frontend/src/features/*` (Flashcards, Texts,
  Sentences, Reading, Typing, Dictation, Quiz, Phrases, Exercises, Corrections).
- **Content storage**: static JSON checked into git (`backend/content/*.json`,
  `backend/words/*.json`) — no SQL database.
- **Progress/state persistence**: a Google Sheet via an Apps Script webapp
  (`backend/apps-script/Code.gs`), chosen specifically so hosting can stay free /
  the app's own filesystem can stay ephemeral.
- **Auth**: none — a free-text, format-validated email is the only user identity.
- **Tests**: pytest (backend), vitest (frontend).

## B. Existing language model

```
LanguagePair ("origin-target", e.g. "pt-en", "pt-es" — parsed by
LanguagePair.parse, backend/app/domain/value_objects.py)
  → Chapter (chapter_id, number, title, status: ready/in_development)
      → Topic (topic_id, number, title, word_ids[], texts[], sentences[],
                phrases[], exercises[], status)
```

- `backend/words/catalog.json` — language-agnostic root words: `word_id` +
  `filename` (image asset), nothing else. **This is the one truly pair-independent
  table** — every language pair's content ultimately points back to these ids.
- `backend/words/{target}_words.json` (`en_words.json`, `es_words.json`, one file
  per **target** language, independent of which origin pairs with it) — per-target
  realization: `word_id` (e.g. `en-wd-0001`), `root_word_id`, `word` text,
  `gender_id`. **`Topic.word_ids` reference these target-language ids**, not the
  catalog root id.
- `backend/words/sentences.json` / `cues.json` — keyed
  `{origin|target}_{root_word_id}` → example sentence / definition, so the UI can
  independently choose which of the pair's two languages shows as "sentence" vs.
  "cue" for any given pair.
- `backend/content/{origin}-{target}.json` — one file per language pair (currently
  `pt-en.json`, `pt-es.json`), each with its own chapter/topic tree. **A pair's
  chapters/topics are entirely independent of every other pair's** — pt-en's
  chapter numbering, topic count, and readiness have no relationship to pt-es's.
- Progress is per `(email, lang, word_id)`: `confident`, `shown_count`, `show` —
  stored in the Sheet, rows auto-created on first interaction. Topic *enablement*
  (which topics a user has unlocked) is also Sheet-backed, keyed the same way.
- Corrections are a markup layer applied over texts/exercises at read time, scoped
  to `(lang, chapter_number, topic_number)` — already pair-scoped.

**Implication for the game**: any game content mapping (word → object/action/NPC
role) must key off a `word_id`, the same way every existing repository already
cross-references words, and not anything origin-specific. (Initial analysis
guessed this should be the per-target friendly id, e.g. `en-wd-0001` — Milestone
4 corrected this to the catalog **root** `word_id` instead, since that's what
`GetChapters`/`GetWords` already resolve `Topic.word_ids`/`Word.word_id` to; see
`LANGUAGE_INTEGRATION.md`.) That's what makes one game-content mapping table
automatically usable across every pair that happens to define matching topics,
and what lets a brand-new pair (say `pt-fr`) plug into the game with zero
game-code changes as soon as its own `content/pt-fr.json` exists.

Content readiness snapshot at analysis time (examples only, not a target):
pt-en has a `ready` "Greetings & self-introduction" topic (15 words) and a `ready`
Food chapter with "Ordering food" and "Fruits & Vegetables" (18 words each).
pt-es has its own `ready` "Greetings & self-introduction" topic under the same
`top-A0-EL-1` id (25 words — pt-es's tree is authored independently of pt-en's,
so the word count and vocabulary differ even though the topic id matches).
Whatever topic is picked as the first vertical slice, the same slice logic must
be re-runnable against any other pair's equivalent topic without code changes —
only content differs.

## C. Existing frontend

One big orchestrator (`App.vue`) drives hash routing
(`#/<lang>/<chapterId>/<topicId>/<tab>`) and shows/hides tab components. The
`<lang>` segment is already a first-class part of the URL/state model — the game
tab should follow the same convention rather than inventing a parallel one.
Offline-first: stale-while-revalidate cache + a local write queue for progress
actions made offline. No canvas/rendering library exists anywhere in the stack
today.

## D. Existing backend / API

`GET /languages, /words, /data, /chapters, /reinforcement-words, /tts` and
`POST /corrections, /increment, /mark-known, /show-word`. Every route takes `lang`
as a parameter and resolves it via `LanguagePair.parse` — none of them assume a
specific pair. Each route composes a use case from `application/ports/*`
(`CatalogRepository`, `ProgressRepository`, `TopicsRepository`,
`CorrectionsRepository`) via FastAPI `Depends`. `GetChapters`
(`backend/app/application/use_cases/get_chapters.py`) already filters topics by
per-user enablement and applies corrections, generically over whatever `lang` is
passed — this is the exact shape a game use case should follow.

## E. Game integration strategy

Keep content authoritative and untouched. Add a **separate game bounded context**
that only ever *references* `word_id` / `topic_id` / `lang` — never duplicates
word data, and never assumes which pair it's running against (§49 of
`game_approach.md`, and it matches how `Correction` / `ProgressRecord` already
reference words by id + lang rather than embedding them).

Concretely:

- A new **game-content mapping**, one JSON per pair holding every topic that
  pair has authored game content for, mapping `word_id → game_role / object_type`
  — e.g. `{"wd-0042": {"role": "interactable", "data": {"type": "door"}}}`, keyed
  by catalog **root** `word_id` (see `LANGUAGE_INTEGRATION.md`). Because a root
  id is pair-independent, the exact same mapping shape works for any pair whose
  topic happens to reference that concept, with no game-engine code change —
  only the mapping data differs per pair/topic.
- New ports: `GameContentRepository` (reads the mapping + area layout for a given
  `lang` + `topic_id`), `GameStateRepository` (reads/writes a player's
  authoritative game state, scoped by `email` + `lang`, same scoping progress
  already uses).
- New use cases mirroring the existing pattern: `GetGameArea(lang, topic_id)`,
  `ApplyGameAction(email, lang, action)`.
- The `lang` parameter threads through every new port/use case exactly as it does
  today in `GetChapters`/`GetWords` — there is no code path that hard-codes a
  specific origin or target.

## F. Recommended game technology

**Phaser 3, mounted inside a Vue component** (a `features/game/Game.vue` that
creates a `Phaser.Game` in `onMounted` and destroys it in `onUnmounted`).
Reasoning: `game_approach.md` §23 flags Phaser first; it's framework-agnostic so
it drops cleanly into the existing Vue/Vite setup without pulling in React; and it
gives scenes/tilemaps/physics/input for free instead of hand-rolling them on raw
Canvas or PixiJS. Scene content (which sprites, which labels, which words are
"live") must be **data-driven from the game-content mapping for the current
`lang`**, never hard-coded per pair — the same Phaser scene class renders a pt-en
kitchen or a pt-es kitchen from the same code, different data.

## G. Multiplayer-ready separation

- **Local/client state** (camera, animation, transient UI) — lives inside Phaser
  scenes only.
- **Authoritative game state** (position, inventory, object/puzzle/quest state,
  unlocked abilities) — plain serializable objects, mutated only through an
  explicit action/event layer (`OBJECT_INTERACTED`, `PUZZLE_SOLVED`, etc., per
  §25 of `game_approach.md`), never touched directly by Phaser draw code. Scoped
  by `(email, lang)` — a player's pt-en game state and pt-es game state are
  independent save slots, never merged.
- **Learning state** — untouched; the game *emits* events, the existing progress
  system (already pair-scoped via `(email, lang, word_id)`) stays the source of
  truth for familiarity.
- **Persistence** — Render's filesystem is ephemeral, so authoritative game state
  can't live in local JSON. Cheapest option consistent with this repo's existing
  pattern: extend the Sheets-backed approach with a new tab/repository, same as
  `progress`/`topics`/`corrections` today, keyed the same `(email, lang, ...)` way.

## H. First vertical slice — DECIDED: Greetings & self-introduction

**Chosen anchor topic**: pt-es's `top-A0-EL-1` — "Saudações e Apresentação
Pessoal" / Greetings & self-introduction (25 words, status `ready`, chapter
`ch-A0-EL`).

This makes the first prototype a **conversation-shaped** slice rather than an
object/spatial one: a dialogue-driven intro scene (an entryway, one or two
characters introducing themselves) instead of a market/kitchen fetch-and-give
puzzle. Concretely this decides:

- **World**: a small space built for face-to-face interaction (e.g. a doorway,
  a room where an NPC is met), not an object-dense environment.
- **Puzzle shape** (step 8): something an introduction-vocabulary set can
  actually gate — e.g. the NPC won't proceed/respond until the player produces
  the right greeting/self-introduction phrase, rather than a fetch/give-item
  puzzle.
- **Game-content mapping** (step 4): every one of this topic's 25 words needs
  an authored game role — mostly dialogue lines and a couple of nouns/pronouns
  — before any scene can render. Mapping keys are catalog **root** `word_id`s
  (e.g. `wd-0001`), not the raw content file's per-target friendly ids (e.g.
  `es-wd-0001`) — see `LANGUAGE_INTEGRATION.md`'s Milestone 4 section for why.

The acceptance bar from step 11 still applies unchanged: once this slice works,
pick a *second*, different-pair topic (e.g. pt-en's equivalent, already
`ready`) and confirm the same engine renders it correctly from its own mapping
data alone, with zero code changes.

## I. Proposed roadmap

1. Docs scaffold (`docs/GAME_ARCHITECTURE.md`, `GAME_DESIGN.md`,
   `LANGUAGE_INTEGRATION.md`, `MULTIPLAYER_ARCHITECTURE.md`,
   `DEVELOPMENT_ROADMAP.md`)
2. Game bounded-context skeleton (domain entities, ports, no UI) — `lang`-scoped
   from the start
3. `Game.vue` + empty Phaser scene mounted behind a new tab
4. Static single-room scene rendering from one real topic's `word_ids`, driven by
   the game-content mapping for the active `lang`
5. Player movement + one interactable object
6. Command system (`OPEN DOOR` style, controlled grammar) — vocabulary source is
   whatever `lang`'s topic is active, not a fixed language
7. One NPC with deterministic dialogue + one quest requiring 2–3 words
8. One puzzle solvable only via target-language words
9. Learning-event emission wired to existing progress use cases
10. Persistent game-state repository (Sheets-backed), scoped `(email, lang, ...)`
11. Cross-pair validation: swap `lang` to a second pair's equivalent topic and
    confirm the same build renders correctly with no code changes
12. Polish pass (art direction, accessibility, minimal UI)
13. Deployment check on Render

---

## Decisions log

- **2026-09-22** — First vertical slice anchor topic: **Greetings &
  self-introduction** (see §H). Chosen over Food / Fruits & Vegetables to make
  the first prototype dialogue-driven rather than object/spatial.
- **2026-09-22** — Anchor **pair** switched from pt-en to **pt-es**: same
  `top-A0-EL-1` topic id, but pt-es's own independently-authored 25-word
  vocabulary rather than pt-en's 15-word one. pt-en's equivalent topic becomes
  the step-11 cross-pair validation target instead.
