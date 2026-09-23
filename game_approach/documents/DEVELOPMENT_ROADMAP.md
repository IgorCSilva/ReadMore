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
| 7 | One NPC with deterministic dialogue + one quest requiring 2–3 words | ✅ Done |
| 8 | One puzzle solvable only via target-language words | ✅ Done |
| 9 | Learning-event emission wired to existing progress use cases | ✅ Done |
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

### 7. One NPC with deterministic dialogue + one quest — ✅ Done
- **Objective**: replace Milestone 5's placeholder E-interact toggle with a
  real, scripted conversation: the NPC greets the player, asks a yes/no
  question, and the player must thank the NPC to close it out — three beats,
  each requiring the correct target-language word via the Milestone 6 `SAY`
  command. No branching/AI dialogue — fully deterministic, per
  `GAME_DESIGN.md` principle 5.
- **Decision**: the quest script is matched by the game-content mapping's
  semantic `data.line` tag (`greeting-formal` → `affirmation` →
  `courtesy-thanks`), never a hardcoded `word_id` — see the anchor mapping,
  `game_approach/content/game-pt-es.json`, where these three tags already
  exist as the natural semantic shape of the dialogue-role words. This keeps
  the quest itself language-agnostic: any origin→target pair whose mapping
  tags the same three dialogue beats gets the same quest for free, with zero
  code changes — directly serving the "must work for any pair" guiding
  constraint ahead of Milestone 11's cross-pair validation. A topic missing
  one of the three lines simply gets a shorter quest (`buildQuestSteps`
  filters to whatever lines exist) rather than breaking.
- **Interaction design**: proximity + E (Milestone 5) now *starts* the
  conversation (NPC color changes, first hint appears) instead of toggling a
  meaningless visible state; each recognized `SAY` command afterward is
  forwarded to the scene and advances the conversation one step if it matches
  what the NPC is currently waiting for — wrong words or commands issued
  before the conversation has started are silently ignored (no punishing
  feedback, matching `GAME_DESIGN.md`'s "calm, curious" emotional target).
  Hint text above the NPC ("Say hello." / "Answer yes." / "Say thank you." /
  "Quest complete!") is plain English narration, not target-language content —
  same convention as the existing "Press E to talk" prompt; the *word the
  player must produce* is the only target-language content, per the design
  principle that language is a tool, not the lesson.
- **Files**: `frontend/src/features/game/quest.ts` (new — pure
  `buildQuestSteps`/`advanceQuest`/`questPrompt`), `quest.test.ts` (new, 10
  tests), `frontend/src/features/game/Game.vue` (`MainScene` gains
  `questSteps`/`questProgress`/`questStarted` state, `setQuestSteps`/
  `applyAction` methods, module-level `pendingQuestSteps`/`applyQuestSteps`
  mirroring the existing `pendingItems`/`renderInScene` pair; `show()` now
  rebuilds quest steps from `area.objects` on every topic switch;
  `submitCommand()` forwards a recognized action to `sceneInstance.applyAction`
  in addition to showing the existing parse-feedback text). `Game.test.ts`
  unchanged — `MainScene.applyAction`/`setQuestSteps` are exercised only
  through Phaser's real `create()`, which the jsdom `phaserStub` never runs
  (same testing gap already documented for Milestone 5's movement/interact),
  so this milestone's scene-side behavior is covered by `quest.ts`'s pure unit
  tests instead, consistent with `GAME_ARCHITECTURE.md`'s testing strategy.
- **Testing**: `npm run test -- --run` → 22 test files, 142 tests passed (10
  new in `quest.test.ts`, 0 changed in `Game.test.ts`). `vue-tsc -b` clean.
  `npm run build` succeeds (48 modules, same bundle size class).
- **Not verified**: the full conversation flow in a real browser — approach
  the NPC, press E, and `SAY` the three words in order to confirm the hint
  text advances and the NPC's color changes at each stage and on completion.
  Also worth re-confirming Milestone 5/6's still-open browser checks (arrow
  keys, E-interact, typing "e" in the command box) alongside this, since
  they're all exercised by the same manual walkthrough.
- **Multiplayer impact**: quest progress (`questStarted`/`questProgress`)
  still lives only in the Phaser scene instance — local/client state per
  `MULTIPLAYER_ARCHITECTURE.md`'s categories, not yet persisted or sent
  anywhere. Becomes authoritative state once Milestone 9/10 wire
  `ApplyGameAction`/`GameStateRepository`; nothing here blocks that, and the
  `GameAction` shape forwarded to `applyAction` is already the same one
  `ApplyGameAction` will consume.

### 8. One puzzle solvable only via target-language words — ✅ Done
- **Objective**: add a second, independent interactable — a locked gate —
  that opens only by producing the correct target-language word while
  standing near it, directly exercising `GAME_DESIGN.md` principle 4
  ("language controls access, not artificial levels"): there is no other way
  to open the gate.
- **Decision**: same semantic-tag matching convention Milestone 7 established
  for the quest — the required word is found by a `data.concept` tag
  (`"night"`) on a `noun`-role `GameObject` in the active topic's mapping,
  never a hardcoded `word_id`. Any origin→target pair whose mapping tags a
  word with that concept gets a working gate automatically; a topic missing
  it just has no working gate (`wordId: null`) rather than erroring. Chose
  `night` since it's already present in the anchor mapping
  (`game_approach/content/game-pt-es.json`, `wd-0079`) with no new content
  authoring needed.
- **Design choice**: the gate is deliberately a second, independent puzzle
  rather than a gate on the NPC's own quest — it can be opened before,
  during, or after the conversation, and neither affects the other. This
  keeps `MainScene.applyAction` simple (try both, each is a no-op unless its
  own preconditions hold) and avoids coupling two otherwise-unrelated
  mechanics for no design reason. No E-key/proximity-based "start" step like
  the NPC has — the gate just responds directly to a correctly-timed `SAY`
  while in range, since (unlike a conversation) there's no multi-step script
  to begin.
- **Files**: `frontend/src/features/game/gate.ts` (new — pure
  `buildGateState`/`tryOpenGate`), `gate.test.ts` (new, 8 tests),
  `frontend/src/features/game/Game.vue` (`MainScene` gains a `gate`
  rectangle + `gateHintText`, `gateState`, `setGateState`/`applyAction`
  extended; module-level `pendingGateState`/`applyGateState` mirroring the
  existing pending-buffer pair; `show()` rebuilds gate state from
  `area.objects` alongside quest steps on every topic switch). `Game.test.ts`
  unchanged, same testing-gap reasoning as Milestone 7 (`MainScene`'s
  `create()`/`update()` aren't exercised by the jsdom `phaserStub`) — covered
  instead by `gate.ts`'s pure unit tests.
- **Testing**: `npm run test -- --run` → 23 test files, 150 tests passed (8
  new in `gate.test.ts`). `vue-tsc -b` clean. `npm run build` succeeds (49
  modules, same bundle size class).
- **Not verified**: the gate in a real browser — walk to the bottom-right
  corner of the canvas, confirm the "Locked. Try a word." hint appears in
  range, `SAY` the target-language word for "night" while still in range, and
  confirm the gate turns green and the hint changes to "Open." Also confirms
  the gate and the NPC's quest don't interfere with each other when both are
  active.
- **Multiplayer impact**: `gateState` is local/client-only Phaser scene state,
  same category as the quest's `questProgress` — becomes authoritative once
  Milestone 9/10 wire persistence; the `GameAction` shape reaching
  `tryOpenGate` is already what `ApplyGameAction` will consume.

### 9. Learning-event emission wired to existing progress use cases — ✅ Done
- **Objective**: per `GAME_ARCHITECTURE.md`'s "Event system" section, route a
  `WORD_USED` learning event through the *existing* progress use cases
  (`IncrementShownCount` et al.) instead of a parallel game-only tracking
  system, the same way `Flashcards.vue` already does.
- **Decision**: researched the existing progress stack first
  (`backend/app/application/use_cases/{increment_shown_count,mark_word_known,
  show_word_again}.py`, their `POST /increment|/mark-known|/show-word`
  routes in `backend/app/main.py`, and the frontend calling convention) and
  found it's `shown_count` (via `IncrementShownCount`/`POST /increment`) that
  maps onto "this word was engaged with" — there's no richer
  recalled/used-in-context field to hook into, and inventing one is exactly
  what this milestone is meant to avoid. The existing calling convention
  everywhere else (`Flashcards.vue`) is `performWrite("increment", user,
  lang, wordId)` from `frontend/src/shared/writeQueue.ts`, not a raw
  `api.ts` call — reused as-is, which means the game's word-used events get
  offline queueing/retry and toast-on-failure for free.
- **Decision**: the event fires only when a `SAY` command is *consequential*
  — it matched the NPC's current expected quest step, or opened the gate —
  not merely recognized. `MainScene.applyAction` (Milestones 7/8) now
  returns a boolean for this; `submitCommand` fires `performWrite("increment",
  ...)` only when both `result.ok` and that boolean are true. A recognized
  but currently-pointless `SAY` (right word, nothing needs it right now)
  does not record progress — the signal is "this word did something in the
  world," matching `GAME_DESIGN.md`'s "words become abilities" principle,
  not "this word was typed."
- **Decision**: `Game.vue`'s `show()` gained a `userEmail` first parameter
  (`show(userEmail, lang, topic)`), matching every sibling feature's
  `show()`/`load()` convention (`Flashcards.vue`, `Reading.vue`, etc. all
  take `USER_EMAIL` first) — there's no shared session module in this
  codebase; every feature receives it as a plain argument from `App.vue`'s
  own local `USER_EMAIL`/`LANG` state, so the game feature now matches that
  existing pattern instead of inventing its own.
- **Files**: `frontend/src/features/game/Game.vue` (`applyAction` returns
  `boolean`; new `currentUserEmail`/`currentLang` module state set by
  `show()`; `submitCommand` calls `performWrite`), `frontend/src/App.vue`
  (line ~441: `gameRef.value?.show(USER_EMAIL, LANG, currentTopic)`),
  `Game.test.ts` (all `show()` calls updated to the 3-arg signature; mock
  extended with `incrementShownCount`/`markWordKnown`/`showWordAgain` since
  `writeQueue.ts` imports all three eagerly; one assertion added confirming
  an unrecognized command never calls `incrementShownCount`).
- **Testing**: `npm run test -- --run` → 23 test files, 150 tests passed (no
  net-new test files — extended existing `Game.test.ts` coverage).
  `vue-tsc -b` clean. `npm run build` succeeds (49 modules, same bundle size
  class).
- **Not verified**: the actual progress increment in a real browser/backend
  — same Phaser-internal testing gap as Milestones 7–8 (`applyAction`'s
  return value is only exercised through Phaser's real `update()`/`create()`
  lifecycle, which the jsdom stub never runs). Worth confirming manually:
  say the NPC's next expected word (or the gate's word while in range) and
  check the word's `shown_count` increments via the existing progress
  endpoints/UI (e.g. reopen Flashcards for that word).
- **Multiplayer impact**: none new — this reuses the existing
  single-player-scoped progress system (`email`+`lang` keyed), unrelated to
  `PlayerGameState`/`GameStateRepository`.

### 10–13
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
