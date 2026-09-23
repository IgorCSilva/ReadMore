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

- Milestone 2 done: domain entities (`GameObject`, `GameArea`, `GameAction`,
  `PlayerGameState`) and ports (`GameContentRepository`, `GameStateRepository`)
  exist; no concrete infrastructure or UI yet.
- Milestone 3 done: `features/game/Game.vue` mounts an empty Phaser scene
  behind a new "Game" tab, wired into `App.vue` exactly like every other tab.
  No scene content, no command system, no backend wiring yet — see
  `DEVELOPMENT_ROADMAP.md` for the per-milestone detail, including a testing
  gotcha worth knowing before touching `Game.vue` again: jsdom has no
  WebGL/canvas context, so `'phaser'` is globally mocked in
  `frontend/vitest.setup.ts` (backed by `frontend/src/test-utils/
  phaserStub.ts`) rather than per-test-file.
- Milestone 4 done: `GameContentRepository`/`GetGameArea` are now concrete
  (`JsonGameContentRepository` reads `game_approach/content/game-{pair}.json`)
  and wired to a new `GET /game-area?lang=&topic=` route. `Game.vue`'s
  `show(lang, topic)` fetches that area plus `/words`, resolves each
  `GameObject.word_id` to its display text (`features/game/sceneItems.ts`'s
  `buildSceneItems`), and renders one color-coded `Phaser.GameObjects.Text`
  per word. Anchor pair switched from pt-en to **pt-es** for this slice (see
  `DEVELOPMENT_ROADMAP.md`'s Milestone 4 detail and decisions log) — pt-en's
  equivalent topic remains the step-11 cross-pair validation target. The
  game-content mapping key convention was also finalized here: catalog
  **root** `word_id` (not the per-target friendly id the original draft in
  `LANGUAGE_INTEGRATION.md` assumed) — see that document's Milestone 4
  section for the full reasoning.
- Milestone 5 done: `Game.vue`'s `MainScene` now has arcade-physics player
  movement (arrow keys, bounded to the canvas) and one interactable object —
  the NPC anchor for this slice — with a proximity-based prompt and an
  interact-key toggle. Proximity math lives in `features/game/interaction.ts`
  (pure, Phaser-free, unit-tested the same way `sceneItems.ts`'s
  `buildSceneItems` is). No dialogue or language-gating yet — that's
  Milestones 6–7.
- Milestone 6 done: the command system's first slice —
  `features/game/command.ts`'s `parseCommand` implements
  `Tokenizer → Vocabulary matcher → Intent → Entities → GameAction` for a
  single grammar, `SAY <word>`, matched against the active topic's real
  vocabulary (see `DEVELOPMENT_ROADMAP.md`'s Milestone 6 detail for why SAY
  rather than the `OPEN DOOR`-style examples above — this slice's vocabulary
  has no verbs). `Game.vue` exposes a text input wired to it, showing
  recognized/rejected feedback; not yet connected to NPC dialogue
  consequences (Milestone 7). Also fixed a latent Milestone 5 bug where
  Phaser's default keyboard-capture behavior called `preventDefault()` on
  arrow/E keydowns app-wide regardless of focus — same class of issue as the
  Flashcards.vue fix, opposite direction.
- Milestone 7 done: the NPC now runs a real, deterministic three-beat
  conversation (`features/game/quest.ts`) instead of Milestone 5's placeholder
  toggle — greet, answer yes, say thanks — each beat requiring the matching
  `SAY` command. The script is matched by the game-content mapping's semantic
  `data.line` tag, not a hardcoded `word_id`, so it works unmodified for any
  origin→target pair whose mapping tags those three dialogue beats the same
  way (see `DEVELOPMENT_ROADMAP.md`'s Milestone 7 detail). Quest progress is
  still local/client-only Phaser scene state — no backend wiring yet.
- Milestone 8 done: a second, independent interactable — a locked gate
  (`features/game/gate.ts`) — that opens only by `SAY`ing the target-language
  word tagged with a specific `data.concept` while standing near it. Same
  semantic-tag matching convention as Milestone 7's quest, so it works
  unmodified for any pair whose mapping tags a word with that concept. Not
  coupled to the NPC's quest — independently solvable, still local/client
  state only.
- Milestone 9 done: a first, minimal slice of the "Event system" section
  above — a `WORD_USED`-shaped event now fires through the *existing*
  `IncrementShownCount`/`POST /increment` use case (via
  `shared/writeQueue.ts`'s `performWrite`, the same call every other feature
  already uses), rather than a parallel tracking system, whenever a `SAY`
  command is consequential (matches the NPC's expected step, or opens the
  gate) — not merely recognized. The richer candidate event set
  (`WORD_DISCOVERED`, `QUEST_COMPLETED`, etc.) still has no dedicated backend
  support; only what `IncrementShownCount` already exposes is wired up so
  far.
