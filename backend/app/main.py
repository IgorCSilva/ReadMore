"""FastAPI entrypoint — Phase 1 of RESTRUCTURE_PLAN.md.

Stands up alongside backend/server.py, not replacing it yet. Endpoints are
ported one at a time (see RESTRUCTURE_PLAN.md Phase 1) behind the layered
domain/application/infrastructure structure. This is the composition root:
it's the only place concrete infrastructure classes get instantiated and
handed to use cases via FastAPI's Depends.
"""
import os
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.application.use_cases.get_chapters import GetChapters
from backend.app.application.use_cases.get_user_words import GetUserWords
from backend.app.application.use_cases.get_words import GetWords
from backend.app.application.use_cases.increment_shown_count import IncrementShownCount
from backend.app.application.use_cases.list_languages import ListLanguages
from backend.app.application.use_cases.mark_word_known import MarkWordKnown
from backend.app.application.use_cases.show_word_again import ShowWordAgain
from backend.app.domain.exceptions import LanguageNotFoundError, WordNotAssignedError
from backend.app.domain.value_objects import Email
from backend.app.infrastructure.dtos.chapters import ChapterDTO, ChaptersResponse
from backend.app.infrastructure.dtos.progress_actions import ProgressActionRequest
from backend.app.infrastructure.dtos.user_words import UserWordDTO, UserWordsResponse
from backend.app.infrastructure.dtos.words import WordDTO, WordsResponse
from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories.google_sheets_progress_repository import (
    GoogleSheetsProgressRepository,
)
from backend.app.infrastructure.repositories.google_sheets_topics_repository import (
    GoogleSheetsTopicsRepository,
)
from backend.app.infrastructure.repositories.json_catalog_repository import JsonCatalogRepository

BACKEND_DIR = Path(__file__).resolve().parent.parent
CATALOG_PATH = BACKEND_DIR / "catalog.json"

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")

app = FastAPI()

# backend/server.py's _send_json sets Access-Control-Allow-Origin: * on every
# response (success or error), and handles OPTIONS preflight itself. This
# replicates that for every route uniformly rather than per-endpoint.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(LanguageNotFoundError)
async def language_not_found_handler(request: Request, exc: LanguageNotFoundError):
    return JSONResponse(status_code=404, content={"error": str(exc)})


@app.exception_handler(WordNotAssignedError)
async def word_not_assigned_handler(request: Request, exc: WordNotAssignedError):
    return JSONResponse(status_code=404, content={"error": str(exc)})


@app.exception_handler(SheetsError)
async def sheets_error_handler(request: Request, exc: SheetsError):
    return JSONResponse(status_code=502, content={"error": str(exc)})


def get_catalog_repository() -> JsonCatalogRepository:
    return JsonCatalogRepository(CATALOG_PATH)


def get_progress_repository() -> GoogleSheetsProgressRepository:
    return GoogleSheetsProgressRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)


def get_topics_repository() -> GoogleSheetsTopicsRepository:
    return GoogleSheetsTopicsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)


def _parse_progress_action(
    payload: ProgressActionRequest,
) -> tuple[Email, str, str] | JSONResponse:
    """Shared validation for /increment, /mark-known, /show-word: same checks,
    same error messages/shapes as backend/server.py's do_POST."""
    lang = payload.lang.strip() or "english"
    try:
        email = Email(payload.user.strip())
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "missing or invalid 'user'"})
    if not payload.word_id:
        return JSONResponse(status_code=400, content={"error": "missing 'word_id'"})
    return email, lang, payload.word_id


@app.get("/languages")
def get_languages(
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
):
    use_case = ListLanguages(catalog_repository)
    return {"languages": use_case.execute()}


@app.get("/words", response_model=WordsResponse)
def get_words(
    lang: str = "english",
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
):
    lang = lang.strip() or "english"
    use_case = GetWords(catalog_repository)
    words = use_case.execute(lang)
    return WordsResponse(lang=lang, words=[WordDTO.from_entity(w) for w in words])


@app.get("/data", response_model=UserWordsResponse)
def get_data(
    user: str = "",
    lang: str = "english",
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
    progress_repository: GoogleSheetsProgressRepository = Depends(get_progress_repository),
):
    lang = lang.strip() or "english"
    try:
        email = Email(user.strip())
    except ValueError:
        return JSONResponse(
            status_code=400, content={"error": "missing or invalid 'user' query param"}
        )

    use_case = GetUserWords(catalog_repository, progress_repository)
    pairs = use_case.execute(email, lang)
    return UserWordsResponse(
        lang=lang,
        words=[UserWordDTO.from_word_and_progress(word, record) for word, record in pairs],
    )


@app.get("/chapters", response_model=ChaptersResponse)
def get_chapters_route(
    user: str = "",
    lang: str = "english",
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
    topics_repository: GoogleSheetsTopicsRepository = Depends(get_topics_repository),
):
    lang = lang.strip() or "english"
    try:
        email = Email(user.strip())
    except ValueError:
        return JSONResponse(
            status_code=400, content={"error": "missing or invalid 'user' query param"}
        )

    use_case = GetChapters(catalog_repository, topics_repository)
    chapters = use_case.execute(email, lang)
    return ChaptersResponse(lang=lang, chapters=[ChapterDTO.from_entity(c) for c in chapters])


@app.post("/increment")
def post_increment(
    payload: ProgressActionRequest,
    progress_repository: GoogleSheetsProgressRepository = Depends(get_progress_repository),
):
    parsed = _parse_progress_action(payload)
    if isinstance(parsed, JSONResponse):
        return parsed
    email, lang, word_id = parsed

    shown_count = IncrementShownCount(progress_repository).execute(email, lang, word_id)
    return {"word_id": word_id, "shown_count": shown_count}


@app.post("/mark-known")
def post_mark_known(
    payload: ProgressActionRequest,
    progress_repository: GoogleSheetsProgressRepository = Depends(get_progress_repository),
):
    parsed = _parse_progress_action(payload)
    if isinstance(parsed, JSONResponse):
        return parsed
    email, lang, word_id = parsed

    MarkWordKnown(progress_repository).execute(email, lang, word_id)
    return {"word_id": word_id, "show": False}


@app.post("/show-word")
def post_show_word(
    payload: ProgressActionRequest,
    progress_repository: GoogleSheetsProgressRepository = Depends(get_progress_repository),
):
    parsed = _parse_progress_action(payload)
    if isinstance(parsed, JSONResponse):
        return parsed
    email, lang, word_id = parsed

    ShowWordAgain(progress_repository).execute(email, lang, word_id)
    return {"word_id": word_id, "show": True}
