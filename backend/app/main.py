"""FastAPI entrypoint — completes Phase 1 of RESTRUCTURE_PLAN.md.

Replaces backend/server.py entirely: every endpoint plus static serving of
frontend/dist/ (the Vite build output — see RESTRUCTURE_PLAN.md Step 2.7)
now lives here, behind the layered domain/application/infrastructure
structure. This is the composition root: it's the only place concrete
infrastructure classes get instantiated and handed to use cases via
FastAPI's Depends.
"""
import os
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.application.use_cases.add_correction import AddCorrection
from backend.app.application.use_cases.get_chapters import GetChapters
from backend.app.application.use_cases.get_user_words import GetUserWords
from backend.app.application.use_cases.get_words import GetWords
from backend.app.application.use_cases.increment_shown_count import IncrementShownCount
from backend.app.application.use_cases.list_languages import ListLanguages
from backend.app.application.use_cases.mark_word_known import MarkWordKnown
from backend.app.application.use_cases.show_word_again import ShowWordAgain
from backend.app.application.use_cases.synthesize_speech import SynthesizeSpeech
from backend.app.domain.exceptions import (
    InvalidCorrectionError,
    LanguageNotFoundError,
    TtsUpstreamError,
    WordNotAssignedError,
)
from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.dtos.chapters import ChapterDTO, ChaptersResponse
from backend.app.infrastructure.dtos.corrections import CorrectionCreateRequest
from backend.app.infrastructure.dtos.progress_actions import ProgressActionRequest
from backend.app.infrastructure.dtos.user_words import UserWordDTO, UserWordsResponse
from backend.app.infrastructure.dtos.words import WordDTO, WordsResponse
from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories.google_sheets_corrections_repository import (
    GoogleSheetsCorrectionsRepository,
)
from backend.app.infrastructure.repositories.google_sheets_progress_repository import (
    GoogleSheetsProgressRepository,
)
from backend.app.infrastructure.repositories.google_sheets_topics_repository import (
    GoogleSheetsTopicsRepository,
)
from backend.app.infrastructure.repositories.google_translate_tts_client import (
    GoogleTranslateTtsClient,
)
from backend.app.infrastructure.repositories.json_catalog_repository import JsonCatalogRepository

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
DIST_DIR = ROOT_DIR / "frontend" / "dist"
WORDS_DIR = BACKEND_DIR / "words"
CATALOG_PATH = WORDS_DIR / "catalog.json"
CONTENT_DIR = BACKEND_DIR / "content"
SENTENCES_PATH = WORDS_DIR / "sentences.json"
CUES_PATH = WORDS_DIR / "cues.json"

LANG_CHOICES = {"origin", "target"}

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


@app.exception_handler(InvalidCorrectionError)
async def invalid_correction_handler(request: Request, exc: InvalidCorrectionError):
    return JSONResponse(status_code=400, content={"error": str(exc)})


@app.exception_handler(SheetsError)
async def sheets_error_handler(request: Request, exc: SheetsError):
    return JSONResponse(status_code=502, content={"error": str(exc)})


@app.exception_handler(TtsUpstreamError)
async def tts_upstream_error_handler(request: Request, exc: TtsUpstreamError):
    return JSONResponse(status_code=502, content={"error": str(exc)})


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Matches backend/server.py's _send_json(404, {"error": "not found"}) for
    # any path that isn't a known API route or an allowed static asset.
    if exc.status_code == 404:
        return JSONResponse(status_code=404, content={"error": "not found"})
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


# dist/assets holds Vite's hashed JS/CSS bundles; dist/images is the
# frontend/public/images/ directory Vite copies through unchanged on build.
app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
app.mount("/images", StaticFiles(directory=DIST_DIR / "images"), name="images")


@app.get("/")
def get_index():
    return FileResponse(DIST_DIR / "index.html")


def get_catalog_repository() -> JsonCatalogRepository:
    return JsonCatalogRepository(CATALOG_PATH, CONTENT_DIR, SENTENCES_PATH, CUES_PATH)


def get_progress_repository() -> GoogleSheetsProgressRepository:
    return GoogleSheetsProgressRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)


def get_topics_repository() -> GoogleSheetsTopicsRepository:
    return GoogleSheetsTopicsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)


def get_corrections_repository() -> GoogleSheetsCorrectionsRepository:
    return GoogleSheetsCorrectionsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)


def get_tts_port() -> GoogleTranslateTtsClient:
    return GoogleTranslateTtsClient()


def _parse_lang(raw: str) -> LanguagePair:
    """Raises LanguageNotFoundError for anything that isn't a valid
    'origin-target' pair key — the same "unknown language" a caller would
    see if the value simply didn't match a catalog entry, since from the
    caller's perspective it doesn't."""
    try:
        return LanguagePair.parse(raw)
    except ValueError:
        raise LanguageNotFoundError(raw) from None


def _parse_lang_choice(raw: str, default: str, param_name: str) -> str | JSONResponse:
    """Validates a sentence_lang/cue_lang query param against {"origin",
    "target"} — the only two choices meaningful for any pair, since each
    just picks which of the pair's own two languages to resolve in."""
    choice = raw.strip() or default
    if choice not in LANG_CHOICES:
        return JSONResponse(
            status_code=400,
            content={"error": f"invalid '{param_name}': must be 'origin' or 'target'"},
        )
    return choice


def _parse_progress_action(
    payload: ProgressActionRequest,
) -> tuple[Email, LanguagePair, str] | JSONResponse:
    """Shared validation for /increment, /mark-known, /show-word: same checks,
    same error messages/shapes as backend/server.py's do_POST. A malformed
    lang value raises LanguageNotFoundError, caught by the registered
    exception handler — not handled locally like the other two checks,
    since unlike them it isn't specific to these three routes."""
    lang = _parse_lang(payload.lang.strip() or "pt-en")
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
    pairs = use_case.execute()
    return {"languages": [str(pair) for pair in pairs]}


@app.get("/words", response_model=WordsResponse)
def get_words(
    lang: str = "pt-en",
    sentence_lang: str = "target",
    cue_lang: str = "origin",
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
):
    language_pair = _parse_lang(lang.strip() or "pt-en")
    sentence_choice = _parse_lang_choice(sentence_lang, "target", "sentence_lang")
    if isinstance(sentence_choice, JSONResponse):
        return sentence_choice
    cue_choice = _parse_lang_choice(cue_lang, "origin", "cue_lang")
    if isinstance(cue_choice, JSONResponse):
        return cue_choice

    use_case = GetWords(catalog_repository)
    words = use_case.execute(language_pair, sentence_choice, cue_choice)
    return WordsResponse(lang=str(language_pair), words=[WordDTO.from_entity(w) for w in words])


@app.get("/data", response_model=UserWordsResponse)
def get_data(
    user: str = "",
    lang: str = "pt-en",
    sentence_lang: str = "target",
    cue_lang: str = "origin",
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
    progress_repository: GoogleSheetsProgressRepository = Depends(get_progress_repository),
    topics_repository: GoogleSheetsTopicsRepository = Depends(get_topics_repository),
):
    language_pair = _parse_lang(lang.strip() or "pt-en")
    sentence_choice = _parse_lang_choice(sentence_lang, "target", "sentence_lang")
    if isinstance(sentence_choice, JSONResponse):
        return sentence_choice
    cue_choice = _parse_lang_choice(cue_lang, "origin", "cue_lang")
    if isinstance(cue_choice, JSONResponse):
        return cue_choice
    try:
        email = Email(user.strip())
    except ValueError:
        return JSONResponse(
            status_code=400, content={"error": "missing or invalid 'user' query param"}
        )

    use_case = GetUserWords(catalog_repository, progress_repository, topics_repository)
    pairs = use_case.execute(email, language_pair, sentence_choice, cue_choice)
    return UserWordsResponse(
        lang=str(language_pair),
        words=[UserWordDTO.from_word_and_progress(word, record) for word, record in pairs],
    )


@app.get("/chapters", response_model=ChaptersResponse)
def get_chapters_route(
    user: str = "",
    lang: str = "pt-en",
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
    topics_repository: GoogleSheetsTopicsRepository = Depends(get_topics_repository),
    corrections_repository: GoogleSheetsCorrectionsRepository = Depends(get_corrections_repository),
):
    language_pair = _parse_lang(lang.strip() or "pt-en")
    try:
        email = Email(user.strip())
    except ValueError:
        return JSONResponse(
            status_code=400, content={"error": "missing or invalid 'user' query param"}
        )

    use_case = GetChapters(catalog_repository, topics_repository, corrections_repository)
    chapters = use_case.execute(email, language_pair)
    return ChaptersResponse(
        lang=str(language_pair), chapters=[ChapterDTO.from_entity(c) for c in chapters]
    )


@app.post("/corrections")
def post_correction(
    payload: CorrectionCreateRequest,
    corrections_repository: GoogleSheetsCorrectionsRepository = Depends(get_corrections_repository),
):
    use_case = AddCorrection(corrections_repository)
    use_case.execute(
        payload.chapter_number,
        payload.topic_number,
        payload.lang.strip() or "pt-en",
        payload.current,
        payload.correction,
    )
    return {"ok": True}


@app.get("/tts")
def get_tts(
    text: str = "",
    lang: str = "en",
    tts_port: GoogleTranslateTtsClient = Depends(get_tts_port),
):
    text = text.strip()
    if not text:
        return JSONResponse(status_code=400, content={"error": "missing 'text' query param"})
    lang = lang.strip() or "en"

    audio_bytes, content_type = SynthesizeSpeech(tts_port).execute(text, lang)
    return Response(
        content=audio_bytes,
        media_type=content_type,
        headers={"Cache-Control": "no-store"},
    )


@app.post("/increment")
def post_increment(
    payload: ProgressActionRequest,
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
    topics_repository: GoogleSheetsTopicsRepository = Depends(get_topics_repository),
    progress_repository: GoogleSheetsProgressRepository = Depends(get_progress_repository),
):
    parsed = _parse_progress_action(payload)
    if isinstance(parsed, JSONResponse):
        return parsed
    email, lang, word_id = parsed

    use_case = IncrementShownCount(catalog_repository, topics_repository, progress_repository)
    shown_count = use_case.execute(email, lang, word_id)
    return {"word_id": word_id, "shown_count": shown_count}


@app.post("/mark-known")
def post_mark_known(
    payload: ProgressActionRequest,
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
    topics_repository: GoogleSheetsTopicsRepository = Depends(get_topics_repository),
    progress_repository: GoogleSheetsProgressRepository = Depends(get_progress_repository),
):
    parsed = _parse_progress_action(payload)
    if isinstance(parsed, JSONResponse):
        return parsed
    email, lang, word_id = parsed

    use_case = MarkWordKnown(catalog_repository, topics_repository, progress_repository)
    use_case.execute(email, lang, word_id)
    return {"word_id": word_id, "show": False}


@app.post("/show-word")
def post_show_word(
    payload: ProgressActionRequest,
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
    topics_repository: GoogleSheetsTopicsRepository = Depends(get_topics_repository),
    progress_repository: GoogleSheetsProgressRepository = Depends(get_progress_repository),
):
    parsed = _parse_progress_action(payload)
    if isinstance(parsed, JSONResponse):
        return parsed
    email, lang, word_id = parsed

    use_case = ShowWordAgain(catalog_repository, topics_repository, progress_repository)
    use_case.execute(email, lang, word_id)
    return {"word_id": word_id, "show": True}
