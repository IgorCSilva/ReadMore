# Development Roadmap

Tracks milestone status for the ReadMore game. Each milestone follows the
methodology in `game_approach.md` §39: objective → why → files touched →
implement → test/build/lint → verify → what you should see → next milestone.
Don't start a milestone before the previous one is verified working.

Anchor topic for Milestones 3–10: pt-en `top-A0-EL-1` "Greetings &
self-introduction" (15 words) — see `PROJECT_ANALYSIS.md` §H and
`GAME_DESIGN.md`.

## Status

| # | Milestone | Status |
|---|---|---|
| 1 | Docs scaffold | ✅ Done (this set of files) |
| 2 | Game bounded-context skeleton (domain entities, ports, no UI) | Not started |
| 3 | `Game.vue` + empty Phaser scene mounted behind a new tab | Not started |
| 4 | Static single-room scene rendering from Greetings topic + game-content mapping | Not started |
| 5 | Player movement + one interactable object | Not started |
| 6 | Command system (`OPEN DOOR`-style, controlled grammar) | Not started |
| 7 | One NPC with deterministic dialogue + one quest requiring 2–3 words | Not started |
| 8 | One puzzle solvable only via target-language words | Not started |
| 9 | Learning-event emission wired to existing progress use cases | Not started |
| 10 | Persistent game-state repository (Sheets-backed) | Not started |
| 11 | Cross-pair validation (swap `lang` to a second pair's topic, zero code changes) | Not started |
| 12 | Polish pass (art direction, accessibility, minimal UI) | Not started |
| 13 | Deployment check on Render | Not started |

## Milestone detail

### 1. Docs scaffold — ✅ Done
- **Files**: `game_approach/documents/{GAME_ARCHITECTURE,GAME_DESIGN,
  LANGUAGE_INTEGRATION,MULTIPLAYER_ARCHITECTURE,DEVELOPMENT_ROADMAP}.md`
- **Multiplayer impact**: none (docs only).
- **Verification**: files exist and cross-reference each other correctly.

### 2. Game bounded-context skeleton
- **Objective**: create `backend/app/domain` additions (or a new
  `backend/app/game/domain` module — decide at implementation time) for
  `GameArea`, `GameObject`, `GameAction`, plus the two new ports
  (`GameContentRepository`, `GameStateRepository`) with no concrete
  implementation yet.
- **Why**: establishes the shape everything else builds on, testable in
  isolation before any UI exists.
- **Files**: new domain/port modules only; no changes to existing
  `domain/entities.py` or `application/ports/*`.
- **Testing**: pytest unit tests on the dataclasses/value objects themselves
  (construction/validation), following `backend/tests/domain/*` conventions.
- **Multiplayer impact**: defines the authoritative-state shape — gets this
  right here or Milestone 10/11 pay for it later.

### 3. `Game.vue` + empty Phaser scene
- **Objective**: prove Phaser mounts/unmounts cleanly inside the existing Vue
  tab system with no game logic yet — just a canvas and an empty scene.
- **Files**: `frontend/src/features/game/Game.vue`, `frontend/package.json`
  (add `phaser` dependency), `App.vue` (new tab wiring).
- **Testing**: vitest smoke test that the component mounts/unmounts without
  error; manual check that switching away from the Game tab tears down the
  Phaser instance (no console errors, no lingering render loop).
- **Multiplayer impact**: none yet.

### 4. Static single-room scene from Greetings topic
- **Objective**: render the topic's 15 words as static scene content, sourced
  from a hand-authored game-content mapping file (see
  `LANGUAGE_INTEGRATION.md`), fetched through a new `GET /game-area` endpoint.
- **Files**: game-content mapping JSON, `GameContentRepository` concrete
  implementation, `GetGameArea` use case, `/game-area` route in `main.py`,
  `Game.vue` scene rendering.
- **Testing**: pytest on `GetGameArea`; manual check that the scene shows
  content matching the topic's actual 15 words.
- **Multiplayer impact**: establishes that scene content is 100% data-driven —
  required for both cross-pair support and future multi-client sync.

### 5–13
Detailed objective/files/testing breakdown for each is written immediately
before that milestone starts, once the prior milestone's actual shape is known
— per `game_approach.md` §39, milestones aren't pre-specified in full detail
far in advance.

## Decisions log

- **2026-09-22** — Anchor topic for the first slice: Greetings &
  self-introduction (`PROJECT_ANALYSIS.md` §H).
- **2026-09-22** — Milestone 1 (docs scaffold) completed; documents live in
  `game_approach/documents/`, not a root-level `docs/`.
