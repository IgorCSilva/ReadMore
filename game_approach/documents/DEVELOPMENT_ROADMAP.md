# Development Roadmap

Tracks milestone status for the ReadMore game. Each milestone follows the
methodology in `game_approach.md` §39: objective → why → files touched →
implement → test/build/lint → verify → what you should see → next milestone.
Don't start a milestone before the previous one is verified working.

Anchor topic for Milestones 3–10: pt-es `top-A0-EL-1` "Greetings &
self-introduction" (25 words) — see `PROJECT_ANALYSIS.md` §H and
`GAME_DESIGN.md`. (pt-en has the same topic id with its own independent
15-word vocabulary; it's the step-11 cross-pair validation target.)

## Status

| # | Milestone | Status |
|---|---|---|
| 1 | Docs scaffold | ✅ Done (this set of files) |
| 2 | Game bounded-context skeleton (domain entities, ports, no UI) | ✅ Done |
| 3 | `Game.vue` + empty Phaser scene mounted behind a new tab | ✅ Done |
| 4 | Static single-room scene rendering from Greetings topic + game-content mapping | ✅ Done |
| 5 | Player movement + one interactable object | ✅ Done |
| 6 | Command system (`OPEN DOOR`-style, controlled grammar) | ✅ Done |
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

### 2. Game bounded-context skeleton — ✅ Done
- **Objective**: add `GameObject`, `GameArea`, `GameAction`, `PlayerGameState`
  domain entities, plus the two new ports (`GameContentRepository`,
  `GameStateRepository`), with no concrete implementation yet.
- **Decision**: added to the *existing* `domain/entities.py` /
  `application/ports/` (not a separate `backend/app/game/` subtree) — matches
  how this codebase already splits by kind (entities vs. value objects vs.
  ports), not by feature; catalog/progress/topics/corrections all coexist the
  same way.
- **Files**: `backend/app/domain/entities.py` (4 new dataclasses),
  `backend/app/domain/exceptions.py` (`GameAreaNotFoundError`),
  `backend/app/application/ports/game_content_repository.py` (new),
  `backend/app/application/ports/game_state_repository.py` (new),
  `backend/tests/domain/test_entities.py` (8 new tests).
- **Design choices**: `GameObject.data` and `PlayerGameState.flags` stay
  untyped dicts for now — same reasoning as `Topic.exercises` staying
  `list[dict]` — modeling puzzle/dialogue shape in detail is Milestone 4/7's
  job, not this one's. Neither `GameArea` nor `PlayerGameState` holds
  `email`/`lang` — those are repository call parameters, mirroring
  `ProgressRecord`.
- **Testing**: `docker compose exec readmore python -m pytest backend/tests -q`
  → 109 passed (32 domain, including the 8 new game-entity tests). New port
  modules verified to import cleanly and expose the expected abstract methods.
- **Multiplayer impact**: defines the authoritative-state shape
  (`PlayerGameState`) independent of any transport — Milestone 10/11 build on
  this without redefining it.

### 3. `Game.vue` + empty Phaser scene — ✅ Done
- **Objective**: prove Phaser mounts/unmounts cleanly inside the existing Vue
  tab system with no game logic yet — just a canvas and an empty scene.
- **Files**: `frontend/src/features/game/Game.vue` (new), `frontend/package.json`
  (added `phaser@4.2.1`), `App.vue` (new "Game" tab: button, `VALID_TABS`,
  panel-display/active-toggle wiring, show/pause calls — same pattern as every
  other tab), `frontend/vitest.setup.ts` (global `phaser` mock — see below),
  `frontend/src/test-utils/phaserStub.ts` (new), `frontend/src/features/game/
  Game.test.ts` (new).
- **Design choices**:
  - `Game.vue` is created once in `onMounted` and stays mounted for the app's
    lifetime (same as Typing/Dictation/Quiz/Phrases) — only its panel's
    `display` is toggled on tab switch. `show()`/`pause()` therefore call
    Phaser's own `game.resume()`/`game.pause()` rather than recreating the
    `Phaser.Game` instance each time.
  - Phaser 4's `Game.pause()/resume()` (not a per-scene-key API) is what
    actually exists in the installed version — verified against the shipped
    type definitions before writing the component, rather than assuming the
    v3-era API `game_approach.md` sketches.
  - **Testing blocker found and fixed**: jsdom has no WebGL/canvas-2d context,
    and Phaser runs real feature-detection at module-*import* time
    (unconditionally) — so the first attempt (mocking `'phaser'` only inside
    `Game.test.ts`) crashed the unrelated `App.test.ts` the moment it
    transitively imported the real Phaser package through `Game.vue`. Fixed by
    moving the mock to `vitest.setup.ts` globally (same file that already
    stubs `window.prompt`/`matchMedia` for other jsdom gaps), backed by a
    shared `test-utils/phaserStub.ts` so `Game.test.ts` can still inspect the
    instances it creates.
- **Testing**: `npm run test -- --run` → 19 test files, 114 tests passed
  (including 2 new `Game.test.ts` tests: mount creates+destroys a
  `Phaser.Game`, `show()`/`pause()` resume/pause it). `vue-tsc --noEmit`
  clean. `npm run build` succeeds (production bundle grew to ~1.5MB gzipped
  ~400KB with real Phaser included — noted as a future code-splitting
  candidate, not addressed now per §42's "measure first").
- **Not verified**: actual WebGL rendering in a real browser — no browser
  automation tool was available in this session. Worth a manual look before
  trusting the canvas paints correctly.
- **Multiplayer impact**: none yet — this milestone is transport/state-free.

### 4. Static single-room scene from Greetings topic — ✅ Done
- **Objective**: render the topic's words as static scene content, sourced
  from a hand-authored game-content mapping file (see
  `LANGUAGE_INTEGRATION.md`), fetched through a new `GET /game-area` endpoint.
- **Decision**: anchor **pair** switched from pt-en to **pt-es** for this and
  future milestones — same `top-A0-EL-1` topic id, but pt-es's own
  independently-authored 25-word vocabulary. pt-en's equivalent (15-word)
  topic becomes the step-11 cross-pair validation target instead of the
  primary slice.
- **Decision**: the game-content mapping's key convention (left as a "draft,
  refined in Milestone 4" placeholder since Milestone 1) is **catalog root
  `word_id`** (e.g. `wd-0001`), not the per-target friendly id
  (`es-wd-0001`) the original draft assumed. Reason: root ids are exactly
  what `GetChapters` already resolves `Topic.word_ids` to and what
  `GetWords`'s `Word.word_id` already is, so the frontend can resolve a
  `GameObject.word_id` straight to its display text via the existing
  `/words` endpoint with zero new translation layer. Friendly ids never
  appear in any API response, so keying on them would have required a new
  endpoint just to resolve text. See `LANGUAGE_INTEGRATION.md`.
- **Files**: `game_approach/content/game-pt-es.json` (new mapping, 25 entries),
  `backend/app/infrastructure/repositories/json_game_content_repository.py`
  (new), `backend/app/application/use_cases/get_game_area.py` (new),
  `backend/app/infrastructure/dtos/game_area.py` (new), `backend/app/main.py`
  (`GET /game-area?lang=&topic=` route + `GameAreaNotFoundError` handler),
  `frontend/src/shared/{api.ts,types.ts}` (`getGameArea`, `GameAreaResponse`),
  `frontend/src/features/game/sceneItems.ts` (new — pure `buildSceneItems`),
  `frontend/src/features/game/Game.vue` (`show(lang, topic)` now fetches and
  renders), `frontend/src/App.vue` (`gameRef.value?.show(LANG, currentTopic)`),
  plus new/updated tests on both sides.
- **Design choices**:
  - `getGameArea` (frontend) deliberately skips the existing
    `fetchJsonWithRetry` helper: a 404 means "no mapping authored for this
    topic yet" — an everyday state for most topics, not a transient failure
    worth retrying for 1.5s. It resolves to `null` for that case instead of
    throwing.
  - `buildSceneItems` (the word_id → display-text/role resolution) lives in
    its own `sceneItems.ts` module, not inside `Game.vue` — `<script setup>`
    cannot contain named ES module exports (Vue compiler restriction), and a
    plain function is easier to unit-test without mounting the component.
  - `MainScene` keeps a module-level `sceneInstance`/`pendingItems` pair
    rather than reaching into Phaser's `SceneManager.getScene()`: Phaser
    boots asynchronously, so `show()`'s fetched data can arrive either before
    or after the scene's own `create()` has run; buffering in `pendingItems`
    handles both orderings without event wiring.
- **Testing**: `docker compose exec readmore python -m pytest backend/tests -q`
  → 116 passed (7 new: 4 repository tests, 3 use-case tests).
  `npm run test -- --run` → 19 test files, 118 tests passed (4 new in
  `Game.test.ts`: `buildSceneItems` word/fallback resolution, `show()`
  fetching/skipping words based on whether a mapping exists). `vue-tsc --noEmit`
  clean. `npm run build` succeeds. Manually verified via `curl` that
  `GET /game-area?lang=pt-es&topic=top-A0-EL-1` returns all 25 objects and
  that every `word_id` resolves to the correct Spanish word via
  `GET /words?lang=pt-es`.
- **Not verified**: actual on-screen text rendering in a real browser — no
  browser automation tool was available this session, same caveat as
  Milestone 3.
- **Multiplayer impact**: establishes that scene content is 100% data-driven —
  required for both cross-pair support and future multi-client sync.

### 5. Player movement + one interactable object — ✅ Done
- **Objective**: add a controllable player character (arrow-key movement,
  bounded to the canvas) and one interactable object — the NPC anchor for
  this dialogue-shaped slice (`GAME_DESIGN.md`'s "Current slice" section) —
  that shows a "Press E to interact" prompt on proximity and toggles a
  visible state when interacted with. No dialogue or language-gating yet
  (Milestones 6–7 build the command system and actual NPC dialogue on top of
  this); per `game_approach.md` §38 ("don't overbuild"), this milestone is
  purely the movement/interaction primitive.
- **Files**: `frontend/src/features/game/interaction.ts` (new — pure
  `distance`/`isWithinInteractRange`), `interaction.test.ts` (new),
  `frontend/src/features/game/Game.vue` (arcade physics config, player/NPC/
  prompt game objects, keyboard input, `update()` loop).
- **Design choices**:
  - Proximity math lives in its own Phaser-free module (`interaction.ts`),
    same reasoning as Milestone 4's `sceneItems.ts`: pure logic is testable
    without booting a canvas, consistent with `GAME_ARCHITECTURE.md`'s
    testing strategy (command parser tests are the other example of this
    split).
  - `MainScene.renderItems` (the word-label grid from Milestone 4) now only
    destroys/recreates its own tracked `wordLabels` array instead of calling
    `this.children.removeAll()` — the previous approach would have wiped the
    player/NPC/prompt every time `show()` re-renders a topic's words.
  - Player and NPC are positioned below the word-label grid (y ≥ 380) so the
    two don't visually overlap on the current 640×480 canvas.
  - Arcade physics body access needs a manual cast
    (`this.player.body as Phaser.Physics.Arcade.Body`) — every Phaser
    `GameObject.body` is statically typed as a
    `Body | StaticBody | MatterJS.BodyType | null` union regardless of which
    physics system is actually active, so the type doesn't narrow
    automatically after `physics.add.existing(...)`. Verified against the
    installed `phaser.d.ts`, same discipline as Milestone 3's
    `pause()`/`resume()` API check.
- **Testing**: `npm run test -- --run` → 20 test files, 123 tests passed (5
  new in `interaction.test.ts`). `vue-tsc --noEmit` clean. `npm run build`
  succeeds.
- **Not verified**: actual movement/interaction feel in a real browser — no
  browser automation tool was available this session, same caveat as
  Milestones 3–4. Worth manually walking the player up to the NPC and
  pressing E before trusting the interact toggle.
- **Multiplayer impact**: none yet — movement/interaction state today lives
  only in the Phaser scene (local/client state per
  `MULTIPLAYER_ARCHITECTURE.md`'s categories). It becomes authoritative state
  once Milestone 10 adds persistence; nothing here blocks that.

### 6. Command system (controlled grammar) — ✅ Done
- **Objective**: prototype the `Tokenizer → Vocabulary matcher → Intent →
  Entities → GameAction` pipeline from `game_approach.md` §34 /
  `GAME_ARCHITECTURE.md`'s "Command system" section, as a pure, unit-tested
  module, plus a minimal text-input UI to exercise it against the active
  topic's real vocabulary. Not yet wired to any gameplay consequence — that's
  Milestone 7's job once actual NPC dialogue exists to react to a recognized
  action.
- **Decision**: the grammar's illustrative examples in `game_approach.md`
  (`OPEN DOOR`, `TAKE KEY`, ...) are all object-manipulation verbs that don't
  exist in this slice's vocabulary — Greetings & self-introduction is
  dialogue-shaped (`GAME_DESIGN.md`'s "Current slice"): its words are dialogue
  lines and nouns/grammar words, no verbs at all. So this milestone's grammar
  is `SAY <word>` — a single fixed, hardcoded intent keyword (not drawn from
  the topic's vocabulary, since it's a universal action available regardless
  of topic), where `<word>` must match a real word from the *active* topic's
  vocabulary. That's what makes it language-gated rather than a free-text
  box: the player has to already know the right target-language word to
  produce a valid command. Future object-heavy topics (Milestone 11+) are
  expected to add their own intents (OPEN, TAKE, ...) once verbs actually
  exist in a topic's vocabulary — the parser isn't hardcoded to SAY-only, that
  set is just what this slice's vocabulary supports today.
- **Files**: `frontend/src/features/game/command.ts` (new — pure `tokenize`/
  `parseCommand`), `command.test.ts` (new), `frontend/src/features/game/
  Game.vue` (command input + feedback UI, `vocabulary` ref populated from the
  same word_id/text pairs `renderItems` already resolves, `submitCommand`),
  `Game.test.ts` (2 new tests: recognized SAY command, unrecognized target).
- **Bug found and fixed**: adding the command `<input>` surfaced a latent bug
  from Milestone 5 — `createCursorKeys()`/`addKey('E')` default to
  `enableCapture: true`, which makes Phaser's `KeyboardManager` call
  `event.preventDefault()` on every matching keydown **anywhere in the
  document**, with no check for focus or active tab (verified by reading
  `node_modules/phaser/src/input/keyboard/KeyboardManager.js`). Left
  unfixed, that would have silently broken typing the letter "e" or using
  arrow keys in any other text input app-wide once the Game tab had ever
  mounted — the same class of cross-feature keydown bug as Milestone 5's
  Flashcards.vue fix, just in the opposite direction (the game's own capture
  breaking *other* features, and this milestone's own command box, instead of
  another feature breaking the game). Fixed with a one-line
  `this.input.keyboard.clearCaptures()` right after creating the cursor/E
  keys in `create()` — this only disables the `preventDefault()` side effect;
  `isDown`/`JustDown` key-state tracking is unaffected. `game_approach.md`'s
  "language commands" section (§12) separately warns not to make commands
  feel like a programming language — unrelated to this fix, noted here only
  because it's the same doc section number space.
- **Testing**: `npm run test -- --run` → 21 test files, 132 tests passed (7
  new in `command.test.ts`, 2 new in `Game.test.ts`). `vue-tsc --noEmit`
  clean. `npm run build` succeeds.
- **Not verified**: actual typing/submitting in a real browser, and that
  `clearCaptures()` doesn't regress arrow-key movement or the E-interact
  toggle from Milestone 5 — no browser automation tool was available this
  session, same caveat as every prior milestone. Worth confirming: (1)
  arrow keys still move the player and E still toggles the NPC after this
  change, and (2) typing in the new command box (including letters like "e"
  and using arrow keys to move the text cursor) works normally.
- **Multiplayer impact**: none yet — `GameAction` objects are constructed and
  displayed client-side only; nothing is sent to the backend until Milestone
  9/10 wire `ApplyGameAction` (`GAME_ARCHITECTURE.md`'s "Command system"
  section already scopes the shape to match that use case's input).

### 7–13
Detailed objective/files/testing breakdown for each is written immediately
before that milestone starts, once the prior milestone's actual shape is known
— per `game_approach.md` §39, milestones aren't pre-specified in full detail
far in advance.

## Decisions log

- **2026-09-22** — Anchor topic for the first slice: Greetings &
  self-introduction (`PROJECT_ANALYSIS.md` §H).
- **2026-09-22** — Milestone 1 (docs scaffold) completed; documents live in
  `game_approach/documents/`, not a root-level `docs/`.
- **2026-09-22** — Anchor pair switched pt-en → **pt-es** (Milestone 4);
  pt-en's equivalent topic becomes the step-11 cross-pair validation target.
- **2026-09-22** — Game-content mapping keys finalized as catalog root
  `word_id`, not the per-target friendly id the Milestone 1 draft assumed
  (Milestone 4; see `LANGUAGE_INTEGRATION.md`).
