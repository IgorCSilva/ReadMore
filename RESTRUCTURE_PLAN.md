# ReadMore — Restructure Plan

Companion to `RESTRUCTURE_REQUIREMENTS.md`. Execute one step at a time, in order.

**Working agreement:**
1. I implement exactly one numbered step.
2. I give you the local test/verification instructions for that step.
3. You run them and confirm the result is OK (or report a problem, which I fix
   before moving on).
4. Once confirmed, I stage only the files touched by that step and commit, using
   the suggested message (or your edit of it).
5. I stop and wait for you to say "next" before starting the following step.

No step ever bundles two phases' worth of change. If a step turns out bigger than
expected once I'm in the code, I split it further rather than expanding scope.

---

## Phase 0 — Safety net (no behavior change)

### Step 0.1 — Add backend test tooling
Add `pytest` to a new `backend/requirements-dev.txt`, add a `backend/tests/`
package, and add one smoke test that starts the current `server.py` and hits
`GET /languages` and `GET /words?lang=english` (both catalog-only, no Sheets
credentials needed).
- **Test locally**: `pip install -r backend/requirements-dev.txt && pytest backend/tests -v`
- **Commit**: `test: add smoke tests for existing server before restructure`

### Step 0.2 — Pin backend dependencies
Add `backend/requirements.txt` (empty/stdlib-only today, but establishes the file
FastAPI will populate in Phase 1) and a `backend/pyproject.toml` or minimal
`setup.cfg` for pytest config (test paths, etc.).
- **Test locally**: `pytest backend/tests -v` still passes; `python3 backend/server.py 8091` still boots and serves `/viewer.html`.
- **Commit**: `chore: add backend dependency/config scaffolding`

---

## Phase 1 — Backend: Clean Architecture skeleton (behavior-preserving)

### Step 1.1 — Install FastAPI, stand up an empty app alongside the old server
Add `fastapi`, `uvicorn`, `pydantic` to `backend/requirements.txt`. Create
`backend/app/main.py` with a FastAPI app exposing only `GET /languages` (reading
`catalog.json` directly, no layering yet) — running side-by-side with `server.py`,
not replacing it.
- **Test locally**: `pip install -r backend/requirements.txt && uvicorn backend.app.main:app --port 8092`, then `curl http://127.0.0.1:8092/languages` matches the output of the old server's `/languages`.
- **Commit**: `feat: stand up FastAPI skeleton alongside existing server`

### Step 1.2 — Domain: `LanguagePair`, `WordId`, `Email` value objects
Add `backend/app/domain/value_objects.py` with these three, each with basic
validation (e.g. `Email` rejects malformed strings using today's `EMAIL_RE`
pattern) and unit tests.
- **Test locally**: `pytest backend/tests/domain -v`
- **Commit**: `feat(domain): add Email, WordId, LanguagePair value objects`

### Step 1.3 — Domain: `Word`, `Chapter`, `Topic`, `Text` entities
Add `backend/app/domain/entities.py` (plain dataclasses, no I/O) plus unit tests
asserting they hold today's catalog fields.
- **Test locally**: `pytest backend/tests/domain -v`
- **Commit**: `feat(domain): add Word, Chapter, Topic, Text entities`

### Step 1.4 — Application: `CatalogRepository` port + `ListLanguages` use case
Add `backend/app/application/ports/catalog_repository.py` (interface) and
`backend/app/application/use_cases/list_languages.py`, plus a unit test using an
in-memory fake repository (no real file/network I/O in this test).
- **Test locally**: `pytest backend/tests/application -v`
- **Commit**: `feat(application): add CatalogRepository port and ListLanguages use case`

### Step 1.5 — Infrastructure: `JsonCatalogRepository` + wire into FastAPI
Implement `backend/app/infrastructure/repositories/json_catalog_repository.py`
against the real `catalog.json`, wire it into `main.py`'s `/languages` route via
`Depends`, replacing the direct file read from Step 1.1.
- **Test locally**: `curl http://127.0.0.1:8092/languages` still matches old server's output; `pytest backend/tests -v` all green.
- **Commit**: `feat(infra): add JsonCatalogRepository, wire ListLanguages through FastAPI`

### Step 1.6 — Repeat the vertical slice for `/words`
Same pattern (entity reuse, use case, controller) for the `/words` endpoint.
- **Test locally**: `curl` comparison against old server for a couple of `lang` values; `pytest backend/tests -v`.
- **Commit**: `feat: port /words endpoint to layered architecture`

### Step 1.7 — Sheets-backed `ProgressRepository` port + `/data`, `/increment`, `/mark-known`, `/show-word`
Split from the original single step: `TopicsRepository` isn't actually used by any
endpoint until `/chapters` (Step 1.8), so it moves there instead of being introduced
unused here. This step: `ProgressRepository` port in `application/ports/`,
`GoogleSheetsProgressRepository` in infrastructure lifting today's
`_sheets_request`/`load_user_lang`/`upsert_progress` logic, a `ProgressRecord`
domain entity, a `WordNotAssignedError` domain exception, use cases
(`GetUserWords`, `IncrementShownCount`, `MarkWordKnown`, `ShowWordAgain`) with
fake-repository unit tests, and a credentials-gated integration test for the real
adapter (skipped if `SHEETS_WEBAPP_URL`/`SHEETS_API_TOKEN` aren't set; read-only —
never calls upsert against the real sheet, to avoid mutating real user data as a
side effect of running tests).
- **Test locally**: `pytest backend/tests -v` (integration test only runs with real `SHEETS_WEBAPP_URL`/`SHEETS_API_TOKEN` set — docker-compose already exports these from `.env`); manual check: `curl` comparison of `/data`, `/increment`, `/mark-known`, `/show-word` against the old server on port 8091 vs. the new one on 8092.
- **Commit**: `feat: port /data, /increment, /mark-known, /show-word to layered architecture`

### Step 1.8 — `TopicsRepository` port + `/chapters`
Split from the original single step, same reasoning as the 1.7 split: `/chapters`
and `/tts` are unrelated to each other, so they don't need to land in the same
commit. This step: `TopicsRepository` port (`get_enabled_topic_ids(email, lang)`),
`GoogleSheetsTopicsRepository` lifting `load_enabled_topics`'s Sheets call, and a
`GetChapters` use case that filters catalog chapters/topics down to the ones
enabled for that user (same visibility rule as `backend/server.py`'s
`handle_chapters`: a chapter survives only if it has at least one visible topic
left after filtering).
- **Test locally**: `pytest backend/tests -v`; `curl` comparison of `/chapters` against the old server for a couple of real users, read-only (topics visibility is a read, not a mutation, so safe to compare directly against real Sheets data).
- **Commit**: `feat: port /chapters to layered architecture`

### Step 1.9 — `TtsPort` + `/tts`
`GoogleTranslateTtsClient` lifting `handle_tts`'s proxy-to-Google-Translate logic
(per RESTRUCTURE_REQUIREMENTS.md §1, TTS is an infrastructure client like the
repositories, even though it's not really CRUD).
- **Test locally**: `curl` comparison of `/tts?text=hello` against the old server (same audio bytes/content-type); `pytest backend/tests -v`.
- **Commit**: `feat: port /tts to layered architecture`

### Step 1.10 — Cutover: retire `server.py`
Update `Dockerfile`/`docker-compose.yaml` to run `uvicorn backend.app.main:app`
instead of `python3 backend/server.py`, serve `frontend/` static files from the
FastAPI app (the one remaining thing `server.py` did that `main.py` doesn't yet),
delete `backend/server.py` and `backend/tests/test_smoke.py` (superseded by the
layered tests).
- **Test locally**: Full manual pass of the app at `http://127.0.0.1:8000/viewer.html` against the new server — flashcards, texts, exercises, TTS audio, mark-known — comparing against current behavior; `pytest backend/tests -v`.
- **Commit**: `feat: complete FastAPI migration, retire stdlib server.py`

---

## Phase 2 — Frontend: Vue restructure (behavior-preserving)

### Step 2.1 — Scaffold Vue + Vite + TS project, serve today's HTML shell as one component
`npm create vite@latest` inside `frontend/` (Vue + TS template). Move
`viewer.html`'s markup/CSS into `App.vue` unchanged (still one big file at this
point) just to get the build pipeline working end-to-end.
- **Test locally**: `cd frontend && npm install && npm run dev`, open the dev URL, confirm it looks identical to today's `viewer.html`.
- **Commit**: `feat(frontend): scaffold Vite+Vue+TS project, port viewer.html as single component`

### Step 2.2 — Add Vitest + a first smoke test
Add `vitest` and `@vue/test-utils`, one test asserting `App.vue` mounts and renders
the tab bar.
- **Test locally**: `npm run test`
- **Commit**: `test(frontend): add Vitest scaffolding and App mount smoke test`

### Step 2.3 — Extract shared API client + TS types
Add `frontend/src/shared/api.ts` (fetch wrappers for `/languages`, `/data`,
`/chapters`, `/words`, `/tts`, `/increment`, `/mark-known`, `/show-word`) and
`frontend/src/shared/types.ts` mirroring the backend's Pydantic DTOs.
- **Test locally**: `npm run test`; `npm run dev` and confirm the app still loads data correctly.
- **Commit**: `refactor(frontend): extract typed API client from inline script`

### Step 2.4 — Extract `features/catalog` (flashcards tab)
Move flashcard-tab markup/logic into `features/catalog/Flashcards.vue`, with a
component test for the flip/mark-known golden path.
- **Test locally**: `npm run test`; manual click-through of the Flashcards tab in the dev server.
- **Commit**: `refactor(frontend): extract Flashcards feature component`

### Step 2.5 — Extract `features/texts` (texts tab)
Same pattern, with a component test asserting `**bold**` spans render as `<strong>`.
- **Test locally**: `npm run test`; manual click-through of the Texts tab.
- **Commit**: `refactor(frontend): extract Texts feature component`

### Step 2.6 — Extract `features/exercises`
Revised from "features/exercises and features/progress": there's no distinct
"progress" UI surface in the actual markup to extract — mark-known/hidden-words/
shown_count tracking already lives inside `#topic-flashcards-panel` and moved with
it into `features/catalog/Flashcards.vue` in Step 2.4, since that's genuinely
where it's coupled in the current app. What's left in App.vue after this step is a
shell owning global concerns (user auth, language selection, chapters/topics
browsing, tab orchestration) plus the three tab-content feature components — a
normal shell + feature-page split, not under-decomposed.

Same extraction pattern as Steps 2.4/2.5: `#topic-exercises-panel` markup +
its script (WORDS_BY_ID cache, loadWordsById, the image lightbox — only used by
exercises' cue images — buildCueEl, boldInline, exercise-type renderers) move into
`features/exercises/Exercises.vue`. `EXT_FALLBACKS` moves with it (no other
consumer left in App.vue after Step 2.4 took its own copy). Coordination: exposed
`show(lang, topic)`, called from `switchTopicTab()`'s exercises branch.
- **Test locally**: `npm run test`; full manual click-through of all tabs.
- **Commit**: `refactor(frontend): extract Exercises feature component`

### Step 2.7 — Wire the build into the server, retire `viewer.html`
Update the backend's static-serving to serve `frontend/dist/` (Vite build output)
instead of raw `viewer.html`; update `Dockerfile` to run `npm run build` in a build
stage. Delete `frontend/viewer.html`.
- **Test locally**: `npm run build` in `frontend/`, then run the backend and confirm `http://127.0.0.1:8000/` serves the built app identically to the dev server.
- **Commit**: `feat: serve built Vue app from backend, retire viewer.html`

---

## Phase 3 — Multi-language-pair generalization

### Step 3.1 — Introduce `LanguagePair`-keyed catalog structure (data + read path only)
Restructure `catalog.json` so each entry is keyed by an explicit pair (e.g. `pt-en`,
`pt-es`) instead of a bare target language, with a migration script converting the
existing file. Update `JsonCatalogRepository` to read the new shape; keep a
compatibility shim so `?lang=english` style requests still resolve during rollout
(or update the frontend in the same step if simpler — decide when we get here).
- **Test locally**: `pytest backend/tests -v`; manual pass confirming both existing pairs still load in the app.
- **Commit**: `feat: key catalog by explicit origin-target language pair`

### Step 3.2 — Propagate `LanguagePair` through use cases/controllers/frontend types
Replace remaining `lang: str` plumbing with the `LanguagePair` value object /
its TS equivalent, end to end.
- **Test locally**: `pytest backend/tests -v`; `npm run test`; manual pass.
- **Commit**: `refactor: thread LanguagePair value object through the stack`

*(Further steps for the users/progress-repository side of this phase are defined
once Phase 4's sheet schema lands, since they're coupled — see Phase 4.)*

---

## Phase 4 — Spreadsheet schema redesign

### Step 4.1 — Design and document the exact users-tab column layout
Finalize the flat schema for the new `users` tab (columns for email, pair, enabled
topics) directly in `RESTRUCTURE_REQUIREMENTS.md` §6 before writing any code.
- **Test locally**: n/a (docs-only step) — review and confirm the schema here before proceeding.
- **Commit**: `docs: finalize users-tab schema`

### Step 4.2 — Add per-user progress tab support to `Code.gs`, behind a feature flag
Extend the Apps Script to read/write per-user tabs (`<email>-progress`) and the new
`users` tab via new `v2_get_progress`/`v2_upsert_progress`/`v2_get_topics` actions,
additive alongside the existing `get`/`upsert`/`get_topics` actions (untouched), so
the existing shared `progress`/`topics` tabs keep working and nothing breaks
mid-migration — the "feature flag" is simply which action name a caller uses.
`actionRemapWordIds`'s per-user-tab iteration (RESTRUCTURE_REQUIREMENTS.md §6) is
deferred to Step 4.4, where the old shared-tab path is actually removed.
- **Test locally**: Apps Script can't run in Docker — deploy the updated `Code.gs` to
  the real Apps Script project (run `setup()` once for the new `users` tab, then
  re-deploy the existing web app so the already-configured `SHEETS_WEBAPP_URL`
  serves the new code). Once deployed, Claude can `curl` the real webapp URL from
  inside the backend container using a fake test email (never `igor.carneiro@gmail.com`
  or `patricia.ramos@gmail.com`) to verify the v2 actions, since they're fully
  additive and can't touch the old tabs.
- **Commit**: `feat(apps-script): support per-user progress tabs`

### Step 4.3 — Write and run the data migration for the two real users
One-off script/manual steps copying `igor.carneiro@gmail.com` and
`patricia.ramos@gmail.com`'s existing rows from the shared `progress`/`topics` tabs
into their new per-user tabs and the new `users` tab.
- **Test locally**: Compare row counts/values before and after in the spreadsheet UI; spot-check a few `word_id`s.
- **Commit**: `chore: migrate existing user data to new sheet schema` *(if the migration itself touches tracked files — otherwise this step has no commit, just a spreadsheet change)*

### Step 4.4 — Point `GoogleSheets*Repository` at the new schema, remove the old path
Update the backend repositories to read/write per-user tabs and the `users` tab
exclusively (via the `v2_*` actions); remove the old `get`/`upsert`/`get_topics`
actions and the shared `progress`/`topics` tabs from `Code.gs`. Also carries
`actionRemapWordIds`'s per-user-tab iteration, deferred here from Step 4.2.
- **Test locally**: Full manual pass logged in as both real users, confirming progress and enabled topics behave identically to before.
- **Commit**: `feat: cut over to per-user sheet schema, remove legacy shared tabs`

---

## Notes

- This file is a living document, same spirit as `RESTRUCTURE_REQUIREMENTS.md` —
  steps can be split further, reordered, or amended as we learn things mid-phase.
- Phase 3's later steps and Phase 4's Step 4.1 schema are intentionally left to be
  finalized right before they're implemented, rather than guessed now.
