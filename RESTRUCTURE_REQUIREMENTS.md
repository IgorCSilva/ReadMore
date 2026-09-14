# ReadMore — Restructure Requirements

Living spec. Update this file whenever a decision below changes — the step-by-step
execution lives in `RESTRUCTURE_PLAN.md` and must stay consistent with whatever
this file currently says.

## 1. Backend architecture — Clean Architecture + DDD + SOLID

Layout (`backend/app/`):

- `domain/` — entities and value objects only. No framework imports, no I/O.
  - Entities (have identity): `User`, `Word`, `Chapter`, `Topic`, `Text`, `ProgressRecord`.
  - Value objects (immutable, no identity): `Email`, `LanguagePair`, `WordId`, `Cue`.
- `application/` — use cases, plus the **repository interfaces (ports)** those use
  cases depend on. Interfaces live here (or in `domain/`), never in `infrastructure/`
  — infrastructure depends inward on application/domain, not the other way around.
  This corrects the original wording ("repository folders in infrastructure"): only
  the *implementations* belong in infrastructure, the *interface* is an
  application-layer concern (Dependency Inversion Principle).
- `infrastructure/` — controllers (FastAPI routers) and repository implementations
  (`JsonCatalogRepository`, `GoogleSheetsProgressRepository`, `GoogleSheetsUserRepository`,
  `GoogleTranslateTtsClient`), plus DTOs (Pydantic models) at the HTTP boundary.
- DTOs never leak domain entities directly into HTTP responses and vice versa —
  explicit mapping functions convert between them.
- SOLID is applied concretely, not abstractly:
  - **DIP** — use cases depend on repository interfaces, never concrete Sheets/JSON
    clients; enables swapping in fakes for tests.
  - **OCP** — adding a language pair or a new exercise type should not require
    editing existing use case code, only adding new data/adapters.
  - **SRP** — controllers only translate HTTP ⇄ DTO ⇄ use case call; use cases hold
    orchestration; entities hold their own invariants.

## 2. Backend framework — FastAPI + Pydantic

Chosen because DTOs and DIP are explicit requirements above, and FastAPI gives both
natively (Pydantic models as DTOs with validation; `Depends` for injecting repository
implementations into use cases at the composition root). Async support also suits the
two outbound network calls the backend already makes (Sheets Apps Script webapp,
Google Translate TTS). Trade-off accepted: this adds a runtime dependency — today's
server is stdlib-only by design, so `requirements.txt`/`pyproject.toml` is new.

## 3. Frontend restructure — Vue 3 + Vite + TypeScript

Replace the single 1571-line `viewer.html` (inline `<style>`/`<script>`) with a
component-based app under `frontend/src/`, split along the same feature boundaries as
the backend domain:

- `features/catalog/` (flashcards)
- `features/texts/`
- `features/exercises/`
- `features/progress/`
- `shared/` — API client, TypeScript types mirroring the backend's Pydantic DTOs, UI
  primitives.

Vue chosen because: Vite is Vue's own tooling (best-in-class pairing, minimal config);
single-file components (`.vue`, combining template/script/style in one file) are the
closest mental model to today's single-file `viewer.html`, making the transition
easier to reason about section-by-section; the Composition API with TypeScript gives
solid typing without React's extra JSX/build ceremony; gentler learning curve for a
solo maintainer while still fully supporting feature-module organization. Trade-off
accepted: smaller ecosystem than React, so less third-party prior art to lean on —
acceptable here since the app's needs (forms, tabs, fetch calls, audio playback) are
all well within Vue's core, no exotic library needed.

Restructure is **behavior-preserving** — same UI, same endpoints, no redesign — so
regressions are easy to spot against the current app. TypeScript types for API
payloads should track the backend DTOs by convention so the two sides can't silently
drift, even without literal shared code yet.

## 4. Tests alongside the restructure

- Backend: unit tests for entities/value objects and use cases (with fake
  repositories, no real network calls); integration tests for controllers via
  FastAPI's `TestClient`. Framework: `pytest`.
- Frontend: component tests per feature covering the current golden paths (flashcard
  flip/mark-known, bold-span text rendering, exercise flow). Framework: `Vitest` +
  `@vue/test-utils`.
- No phase is considered done until its own tests pass locally (see
  `RESTRUCTURE_PLAN.md` for the exact command per step).

## 5. Multi-language-pair support

- Generalize the catalog data model from single target-language keys (`"english"`,
  `"spanish"`, implicitly Portuguese-origin) to explicit origin→target pairs, keyed
  by ISO 639-1 codes (e.g. `pt-en`, `en-es`, `fr-de`).
- **Scope boundary**: this phase makes the *code and data structure* pair-agnostic.
  It does not require authoring new non-Portuguese-origin content — the existing
  Portuguese-origin content becomes the first pair(s) (`pt-en`, `pt-es`) under the
  new structure. Authoring content for a genuinely new origin language (its cues,
  its UI chrome) is a separate, later effort.
- Definition of done: adding a new pair requires only new catalog data + a new
  per-user sheet tab — zero source code changes.

## 6. Spreadsheet schema redesign

Finalized in Phase 4 Step 4.1, against the actual current `apps-script/Code.gs`
(read before designing this, not from memory of the original ask).

### `users` tab (single shared tab, replaces the current `topics` tab)

One row per `(email, language_pair)` — not one row per topic.

| Column          | Type   | Notes |
|-----------------|--------|-------|
| `email`         | string | Lowercased before writing, so a casing difference can't split one real person across two sets of rows (nothing in the app normalizes case today). |
| `language_pair` | string | Canonical pair key (Phase 3), e.g. `pt-en` — not the legacy bare name. |
| `topic_ids`     | string | Comma-separated list of enabled topic_ids for this user+pair, e.g. `top-01, top-02`. **Empty** means: this pair is active for the user with no topic enabled yet — that state falls out naturally now (a row simply exists with an empty list), no separate marker convention needed. |

Both reads Code.gs needs, one row lookup each (a `split(",")` + `trim()` on the
matched cell isn't a parser in any meaningful sense — same category of operation
as reading any other delimited cell value):
- *Active pairs for a user* = rows where `email` matches; one row per pair.
- *Enabled topics for a user+pair* = split `topic_ids` on the matching
  `(email, language_pair)` row.

This is a rename+re-scope of the existing `topics` tab (`lang` → `language_pair`,
`topic_id` → `topic_ids` as a list, grouped to one row per pair instead of one
row per topic) — not a new tab built from scratch.

### Per-user progress tab (one per user, replaces the single shared `progress` tab)

Named `<email>-progress`, `email` lowercased first (same reasoning as the `users`
tab). Sheets tab-name limits (100 chars, no `[ ] * ? / \ :`) aren't a practical
concern for real email addresses — none of those characters are valid in an
email, and no real address plus the `-progress` suffix approaches 100 characters.

**Auto-created on first write** (Step 4.2's upsert action creates the tab with
its header row if it doesn't exist yet), not provisioned manually — onboarding a
new user should need zero spreadsheet admin work, extending this phase's "zero
source changes to add a pair" goal to "zero manual steps to add a user."

| Column          | Type    | Notes |
|-----------------|---------|-------|
| `language_pair` | string  | Same pair-key convention as the `users` tab. `email` is dropped — implicit in which tab a row lives on. |
| `word_id`       | string  | |
| `confident`     | boolean | |
| `shown_count`   | number  | |
| `show`          | boolean | |

### Coordinated changes this forces

- `apps-script/Code.gs` and `backend/app/infrastructure/repositories/
  google_sheets_*.py` change together — a two-sided change, same as every
  Sheets-facing change so far.
- **`actionRemapWordIds`** (Code.gs's existing word_id-renumbering maintenance
  action) currently scans the single shared `progress` tab. Once progress moves
  to per-user tabs, it needs to iterate every tab matching the `*-progress`
  naming convention instead — a real behavior change Step 4.2/4.4 must carry,
  not an incidental side effect. Flagging it now so it isn't dropped.
- **Migration** (Step 4.3) for the two real users (`igor.carneiro@gmail.com`,
  `patricia.ramos@gmail.com`): each user's `progress` tab rows move 1:1 to their
  new `<email>-progress` tab. Their `topics` tab rows (currently one row per
  topic) need to be *grouped* by `(email, language_pair)` first, joining each
  group's `topic_id`s into one `users` tab row's comma-separated `topic_ids` —
  not a 1:1 row copy like the progress side. Both sides translate `lang`
  legacy-name → pair-key (`english`→`pt-en`, `spanish`→`pt-es`) using the same
  mapping as `backend/app/infrastructure/legacy_language_names.py`, so the two
  stay in sync rather than drifting into two different translation tables.
- **Locking granularity**: the relevant lock isn't `backend/server.py`'s old
  global `LOCK` (that file no longer exists — Phase 1) but `Code.gs`'s own
  `LockService.getScriptLock()`, called in every action handler today and
  currently locking the *entire script* — all users, all tabs — for any single
  read or write. Per-user tabs make per-tab locking possible, a real contention
  improvement; Step 4.2/4.4 can decide whether to take it now or defer it.

## Non-goals (explicit, to contain scope)

- No login/auth system beyond today's email-string identification.
- No change to the TTS proxy approach (still proxied server-side, same
  `/tts` contract).
- No UI/UX redesign — the frontend restructure is a re-platform, not a redesign.
- No content authoring for new origin languages in this pass.

## Sequencing

Four largely-independent large changes are in play: backend layering, frontend
restructure, language-pair generalization, and spreadsheet redesign. They are
executed as separate phases in `RESTRUCTURE_PLAN.md`, each independently testable
and committed in small steps — never mixed together in one step.
