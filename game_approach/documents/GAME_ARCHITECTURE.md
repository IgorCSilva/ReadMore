# Game Architecture

Living technical reference for how the game is built and how it fits into the
existing ReadMore codebase. See `PROJECT_ANALYSIS.md` for the original
inspection this is based on, `GAME_DESIGN.md` for what it needs to support, and
`LANGUAGE_INTEGRATION.md` / `MULTIPLAYER_ARCHITECTURE.md` for the two concerns
broken out into their own documents.

## Guiding constraint

Every layer described here must work for **any** origin→target language pair —
never hard-coded to one. Anything scoped to a specific pair in examples below is
illustrative only.

## Where the game sits relative to the existing app

```
Web Application (existing, unchanged)
│
├── language selection / chapters / topics / progress   (existing use cases)
└── game launcher (new tab, follows the existing #/<lang>/... hash convention)
        │
        ▼
     GAME (new bounded context)
        │
        ├── domain: World, Player, NPC, Object, Quest, Puzzle, Interaction
        ├── application: ports + use cases, mirroring
        │                backend/app/application/{ports,use_cases}
        └── infrastructure: game-content repository, game-state repository
```

The game is additive: it reads existing chapters/topics/words through the
existing API (`GET /chapters`, `GET /words`) and adds its own new endpoints for
game-specific concerns. It never modifies `Chapter`/`Topic`/`Word` entities or
their repositories.

## Backend: new ports & use cases (mirrors existing pattern exactly)

Following `backend/app/application/ports/*` and `use_cases/*`:

- **`GameContentRepository`** (port) — reads, for a given `(lang, topic_id)`,
  the game-content mapping: which `word_id`s play which game role (object,
  action, spatial relation, dialogue line) and the static area/dialogue layout
  built around them.
- **`GameStateRepository`** (port) — reads/writes one player's authoritative
  game state, scoped by `(email, lang)` — same scoping `ProgressRepository`
  already uses.
- **`GetGameArea(lang, topic_id)`** (use case) — assembles a playable area:
  topic's words (via existing `CatalogRepository`) + the game-content mapping
  for those words + the player's current game state.
- **`ApplyGameAction(email, lang, action)`** (use case) — validates and applies
  one player action (see event catalog below), returns the resulting state
  delta and any learning events to emit.

Concrete infrastructure implementations follow later milestones once the
mapping file format and persistence choice (see below) are settled.

## Frontend: Phaser inside Vue

- New `frontend/src/features/game/Game.vue`, following the same
  one-component-per-feature convention as `Flashcards.vue`, `Reading.vue`, etc.
- `Game.vue` creates a `Phaser.Game` instance in `onMounted`, targeting a canvas
  ref, and calls `game.destroy(true)` in `onUnmounted` — the same
  mount/pause/teardown discipline `App.vue` already applies to Typing/
  Dictation/Quiz/Phrases when switching tabs (see `switchTopicTab` in
  `App.vue`).
- Added as a new tab in `App.vue`'s existing tab bar (`topic-tab-game`), wired
  into `VALID_TABS` and `switchTopicTab` the same way every other tab is —
  **no new routing mechanism**, reuse the existing
  `#/<lang>/<chapterId>/<topicId>/<tab>` hash convention.
- Scene content (sprites, labels, which words are "live", dialogue text) is
  **entirely data-driven** from `GetGameArea`'s response for the active `lang`.
  The Phaser scene class itself contains no per-topic or per-language logic.

## Command system (controlled grammar, not NLP)

Per `game_approach.md` §34, the first implementation recognizes a fixed set of
valid `INTENT [TARGET]` combinations built from the active topic's vocabulary —
no parser, no grammar engine yet:

```
Input → Tokenizer → Vocabulary matcher (against topic's word_ids) → Intent
  → Entities → GameAction
```

`GameAction` is the same shape `ApplyGameAction` consumes server-side, so the
client never invents an action type the backend doesn't recognize.

## Event system

Both a game-internal concern (driving scene reactions) and a bridge to the
learning system (per `game_approach.md` §25–26). Candidate event set, refined as
milestones land:

```
WORD_DISCOVERED, WORD_RECALLED, WORD_USED
EXPRESSION_DISCOVERED, EXPRESSION_USED
OBJECT_INTERACTED, QUEST_STARTED, QUEST_COMPLETED
PUZZLE_STARTED, PUZZLE_COMPLETED
PLAYER_ENTERED_AREA, NPC_INTERACTION_STARTED
```

Every learning-relevant event carries at minimum: `word_id`, `context`,
`interaction_type`, `success`, `timestamp` — recorded through the *existing*
progress use cases (`IncrementShownCount`, `MarkWordKnown`, etc.), not a
parallel learning-tracking system. The game generates learning data; it does
not bypass or duplicate the learning system.

## State categories (detail in `MULTIPLAYER_ARCHITECTURE.md`)

- **Local/client state** — camera, animation, transient UI — lives only in
  Phaser scene instances, never persisted.
- **Authoritative game state** — position, inventory, object/puzzle/quest
  state, unlocked abilities — plain serializable data, mutated only through
  `ApplyGameAction`, persisted via `GameStateRepository`.
- **Learning state** — untouched, owned entirely by the existing progress
  system.

## Testing strategy (per milestone, extends existing suites)

- Backend: pytest, following `backend/tests/application/*` conventions — one
  test module per use case (`test_get_game_area.py`, `test_apply_game_action.py`).
- Frontend: vitest, following `frontend/src/features/*/*.test.ts` conventions —
  component-level tests for `Game.vue`'s data wiring (not Phaser's internal
  rendering, which isn't practical to unit test).
- Command parser: pure-function unit tests independent of both Phaser and
  FastAPI — `OPEN DOOR` → `GameAction(type=OPEN, target=door)` is a table test.

## Status

Skeleton only — no code written yet. First code lands in Milestone 2 (domain
entities + ports, no UI) per `DEVELOPMENT_ROADMAP.md`.
