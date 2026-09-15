# ReadMore

A vocabulary and reading practice app: flashcards, short texts, and fill-in-the-blank
exercises for learning a new language, with per-user progress tracking (confidence,
times shown, hidden/known words) and an admin-managed set of chapters/topics.

Originally built for a Portuguese speaker learning English/Spanish; the data model is
generalized around explicit origin→target **language pairs** (e.g. `pt-en`, `pt-es`),
so adding a new pair is a data change, not a code change.

## Architecture

**Backend** — Python/FastAPI, layered as Clean Architecture:

```
backend/app/
├── domain/          entities and value objects (Word, Chapter, LanguagePair, Email...),
│                    no framework imports, no I/O
├── application/     use cases + repository interfaces (ports) they depend on
├── infrastructure/  FastAPI routers, DTOs, and repository implementations
│                    (catalog.json on disk, Google Sheets over HTTP, Google
│                    Translate TTS proxy)
└── main.py          composition root — wires concrete infrastructure into use
                      cases via FastAPI's Depends, serves the built frontend
```

Use cases depend only on repository interfaces, never concrete Sheets/JSON clients
(Dependency Inversion), which is what makes them testable with fakes — see
`backend/tests/`.

**Frontend** — Vue 3 + Vite + TypeScript, split by feature:

```
frontend/src/
├── features/
│   ├── catalog/     flashcards
│   ├── texts/       chapter/topic reading view
│   └── exercises/   fill-in-the-blank / classify / open-response exercises
└── shared/          API client, TS types mirroring the backend DTOs,
                      localStorage cache + offline write queue, toast notifications
```

Data-loading reads (`/words`, `/data`, `/chapters`) use a stale-while-revalidate
cache: repeat visits render instantly from the last-saved response while a
background refresh runs, with toast notifications for progress/success/failure.
Progress-writing calls (`/increment`, `/mark-known`, `/show-word`) are optimistic
and queue locally if the network is down, retrying automatically once it's back.

**Persistence** — the word/topic *catalog* (`backend/catalog.json`) lives in the repo.
User *progress* and *enabled topics* live in a Google Sheet instead of a local file, so
they survive on hosts with an ephemeral filesystem: a Google Apps Script Web App
(`backend/apps-script/Code.gs`) exposes a small token-authenticated JSON API over the
sheet — one tab per user for progress (`<email>-progress`), plus a shared `users` tab
listing which topics are enabled per `(email, language_pair)`. See the setup
instructions at the top of `Code.gs`.


## API

| Route | Method | Purpose |
|---|---|---|
| `/languages` | GET | Available language pairs (from `catalog.json`) |
| `/words` | GET | Full word catalog for a language pair |
| `/data` | GET | A user's words + their progress for a language pair |
| `/chapters` | GET | Chapters/topics enabled for a user, with texts and exercises |
| `/tts` | GET | Proxies Google Translate TTS for a given text |
| `/increment` | POST | Record a word as shown (bumps `shown_count`) |
| `/mark-known` | POST | Mark a word confident/known, hides it from the deck |
| `/show-word` | POST | Un-hide a previously known word |

## Tech stack

- **Backend**: Python 3.12, FastAPI, Pydantic, uvicorn, pytest
- **Frontend**: Vue 3, Vite, TypeScript, Vitest, `@vue/test-utils`
- **Persistence**: local JSON catalog + Google Sheets (via Apps Script) for user data
- **Infra**: Docker / Docker Compose, single multi-stage production image
