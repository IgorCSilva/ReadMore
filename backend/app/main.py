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
from backend.app.application.use_cases.chat_with_ai import ChatWithAI
from backend.app.application.use_cases.get_chapters import GetChapters
from backend.app.application.use_cases.get_conversation_words import GetConversationWords
from backend.app.application.use_cases.get_user import GetUser
from backend.app.application.use_cases.get_user_words import GetUserWords
from backend.app.application.use_cases.get_words import GetWords
from backend.app.application.use_cases.get_learning_topic import GetLearningTopic
from backend.app.application.use_cases.get_reinforcement_words import GetReinforcementWords
from backend.app.application.use_cases.get_story import GetStory
from backend.app.application.use_cases.increment_shown_count import IncrementShownCount
from backend.app.application.use_cases.list_languages import ListLanguages
from backend.app.application.use_cases.list_learning_topics import ListLearningTopics
from backend.app.application.use_cases.list_stories import ListStories
from backend.app.application.use_cases.mark_word_known import MarkWordKnown
from backend.app.application.use_cases.record_conversation_words import RecordConversationWords
from backend.app.application.use_cases.show_word_again import ShowWordAgain
from backend.app.application.use_cases.synthesize_speech import SynthesizeSpeech
from backend.app.domain.exceptions import (
    ChatUpstreamError,
    InvalidCorrectionError,
    LanguageNotFoundError,
    LearningTopicNotFoundError,
    StoryNotFoundError,
    TtsUpstreamError,
    WordNotAssignedError,
)
from backend.app.domain.value_objects import Email, LanguagePair
from backend.app.infrastructure.dtos.chapters import ChapterDTO, ChaptersResponse
from backend.app.infrastructure.dtos.chat import ChatRequest, ChatResponse
from backend.app.infrastructure.dtos.conversation_words import (
    ConversationWordDTO,
    ConversationWordsResponse,
)
from backend.app.infrastructure.dtos.corrections import CorrectionCreateRequest
from backend.app.infrastructure.dtos.learning_topics import (
    LearningTopicDTO,
    LearningTopicResponse,
    LearningTopicsResponse,
    LearningTopicSummaryDTO,
)
from backend.app.infrastructure.dtos.progress_actions import ProgressActionRequest
from backend.app.infrastructure.dtos.stories import StoriesResponse, StoryDTO, StoryResponse, StorySummaryDTO
from backend.app.infrastructure.dtos.user_words import UserWordDTO, UserWordsResponse
from backend.app.infrastructure.dtos.words import WordDTO, WordsResponse
from backend.app.infrastructure.repositories.google_sheets_client import SheetsError
from backend.app.infrastructure.repositories.google_sheets_conversation_words_repository import (
    GoogleSheetsConversationWordsRepository,
)
from backend.app.infrastructure.repositories.google_sheets_corrections_repository import (
    GoogleSheetsCorrectionsRepository,
)
from backend.app.infrastructure.repositories.google_sheets_progress_repository import (
    GoogleSheetsProgressRepository,
)
from backend.app.infrastructure.repositories.google_sheets_topics_repository import (
    GoogleSheetsTopicsRepository,
)
from backend.app.infrastructure.repositories.google_sheets_users_repository import (
    GoogleSheetsUsersRepository,
)
from backend.app.infrastructure.repositories.edge_tts_client import EdgeTtsClient
from backend.app.infrastructure.repositories.gemini_chat_client import GeminiChatClient
from backend.app.infrastructure.repositories.json_catalog_repository import JsonCatalogRepository
from backend.app.infrastructure.repositories.json_learning_content_repository import (
    JsonLearningContentRepository,
)
from backend.app.infrastructure.repositories.json_stories_repository import JsonStoriesRepository

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
DIST_DIR = ROOT_DIR / "frontend" / "dist"
WORDS_DIR = BACKEND_DIR / "words"
CATALOG_PATH = WORDS_DIR / "catalog.json"
CONTENT_DIR = BACKEND_DIR / "content"
SENTENCES_PATH = WORDS_DIR / "sentences.json"
CUES_PATH = WORDS_DIR / "cues.json"

LANG_CHOICES = {"origin", "target"}
CEFR_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}
CHAT_HISTORY_LIMIT = 12  # turns sent upstream per request, regardless of what the client holds locally
CONVERSATION_WORDS_LIMIT = 20  # least-used words shown in the conversation page's word strip

SHEETS_WEBAPP_URL = os.environ.get("SHEETS_WEBAPP_URL", "")
SHEETS_API_TOKEN = os.environ.get("SHEETS_API_TOKEN", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# .strip() or "..." rather than os.environ.get(..., default): docker-compose
# always sets this var (interpolated from .env), so an unfilled "GEMINI_MODEL="
# in .env arrives here as "", not absent — which os.environ.get's own default
# wouldn't catch.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "").strip() or "gemini-flash-lite-latest"

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


@app.exception_handler(ChatUpstreamError)
async def chat_upstream_error_handler(request: Request, exc: ChatUpstreamError):
    return JSONResponse(status_code=502, content={"error": str(exc)})


@app.exception_handler(StoryNotFoundError)
async def story_not_found_handler(request: Request, exc: StoryNotFoundError):
    return JSONResponse(status_code=404, content={"error": str(exc)})


@app.exception_handler(LearningTopicNotFoundError)
async def learning_topic_not_found_handler(request: Request, exc: LearningTopicNotFoundError):
    return JSONResponse(status_code=404, content={"error": str(exc)})


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


def get_users_repository() -> GoogleSheetsUsersRepository:
    return GoogleSheetsUsersRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)


def get_corrections_repository() -> GoogleSheetsCorrectionsRepository:
    return GoogleSheetsCorrectionsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)


def get_conversation_words_repository() -> GoogleSheetsConversationWordsRepository:
    return GoogleSheetsConversationWordsRepository(SHEETS_WEBAPP_URL, SHEETS_API_TOKEN)


def get_tts_port() -> EdgeTtsClient:
    return EdgeTtsClient()


def get_chat_port() -> GeminiChatClient:
    return GeminiChatClient(GEMINI_API_KEY, GEMINI_MODEL)


def get_stories_repository() -> JsonStoriesRepository:
    return JsonStoriesRepository(CONTENT_DIR)


def get_learning_content_repository() -> JsonLearningContentRepository:
    return JsonLearningContentRepository(CONTENT_DIR)


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
):
    language_pair = _parse_lang(lang.strip() or "pt-en")
    try:
        email = Email(user.strip())
    except ValueError:
        return JSONResponse(
            status_code=400, content={"error": "missing or invalid 'user' query param"}
        )

    use_case = GetChapters(catalog_repository, topics_repository)
    chapters = use_case.execute(email, language_pair)
    return ChaptersResponse(
        lang=str(language_pair), chapters=[ChapterDTO.from_entity(c) for c in chapters]
    )


@app.get("/user")
def get_user_route(
    email: str = "",
    users_repository: GoogleSheetsUsersRepository = Depends(get_users_repository),
):
    try:
        parsed_email = Email(email.strip())
    except ValueError:
        return JSONResponse(
            status_code=400, content={"error": "missing or invalid 'email' query param"}
        )

    use_case = GetUser(users_repository)
    user = use_case.execute(parsed_email)
    return {"exists": user.exists, "language_pairs": sorted(user.language_pairs)}


@app.get("/reinforcement-words", response_model=list[str])
def get_reinforcement_words_route(
    lang: str = "pt-en",
    chapter: int = 1,
    topic: int = 1,
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
):
    language_pair = _parse_lang(lang.strip() or "pt-en")
    use_case = GetReinforcementWords(catalog_repository)
    return use_case.execute(language_pair, chapter, topic)


@app.get("/api/stories", response_model=StoriesResponse)
def get_stories_route(
    lang: str = "pt-en",
    stories_repository: JsonStoriesRepository = Depends(get_stories_repository),
):
    # Namespaced under /api/, unlike every other route in this file: the
    # frontend's own page for this feature is at /stories (and /stories/
    # <level>/<storyId> for the reader) — matching bare path would make the
    # SPA fallback below unreachable for it, since this route (registered
    # first) would always win the match, same problem the fallback's own
    # comment exists to solve for every other client-side route.
    language_pair = _parse_lang(lang.strip() or "pt-en")
    use_case = ListStories(stories_repository)
    stories = use_case.execute(language_pair)
    return StoriesResponse(
        lang=str(language_pair), stories=[StorySummaryDTO.from_entity(s) for s in stories]
    )


@app.get("/api/stories/{level}/{story_id}", response_model=StoryResponse)
def get_story_route(
    level: str,
    story_id: str,
    lang: str = "pt-en",
    stories_repository: JsonStoriesRepository = Depends(get_stories_repository),
):
    language_pair = _parse_lang(lang.strip() or "pt-en")
    use_case = GetStory(stories_repository)
    story = use_case.execute(language_pair, level, story_id)
    return StoryResponse(lang=str(language_pair), story=StoryDTO.from_entity(story))


@app.get("/api/learning-topics", response_model=LearningTopicsResponse)
def get_learning_topics_route(
    lang: str = "en",
    learning_content_repository: JsonLearningContentRepository = Depends(
        get_learning_content_repository
    ),
):
    # Namespaced under /api/, same reasoning as /api/stories above — the
    # frontend's own page for this feature lives at the bare /learning path.
    code = lang.strip() or "en"
    use_case = ListLearningTopics(learning_content_repository)
    topics = use_case.execute(code)
    return LearningTopicsResponse(
        lang=code, topics=[LearningTopicSummaryDTO.from_entity(t) for t in topics]
    )


@app.get("/api/learning-topics/{theme}/{topic_id}", response_model=LearningTopicResponse)
def get_learning_topic_route(
    theme: str,
    topic_id: str,
    lang: str = "pt-en",
    learning_content_repository: JsonLearningContentRepository = Depends(
        get_learning_content_repository
    ),
):
    # Unlike the listing route above, this one needs the full pair (not just
    # the bare target code) because the topic's glossary overlay is
    # pair-specific — see JsonLearningContentRepository's module docstring.
    language_pair = _parse_lang(lang.strip() or "pt-en")
    use_case = GetLearningTopic(learning_content_repository)
    topic = use_case.execute(language_pair, theme, topic_id)
    return LearningTopicResponse(lang=str(language_pair), topic=LearningTopicDTO.from_entity(topic))


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


@app.get("/conversation-words", response_model=ConversationWordsResponse)
def get_conversation_words_route(
    user: str = "",
    lang: str = "pt-en",
    conversation_words_repository: GoogleSheetsConversationWordsRepository = Depends(
        get_conversation_words_repository
    ),
):
    language_pair = _parse_lang(lang.strip() or "pt-en")
    try:
        email = Email(user.strip())
    except ValueError:
        return JSONResponse(
            status_code=400, content={"error": "missing or invalid 'user' query param"}
        )

    use_case = GetConversationWords(conversation_words_repository)
    words = use_case.execute(email, language_pair)
    return ConversationWordsResponse(
        words=[ConversationWordDTO.from_entity(w) for w in words[:CONVERSATION_WORDS_LIMIT]]
    )


@app.post("/chat", response_model=ChatResponse)
def post_chat(
    payload: ChatRequest,
    chat_port: GeminiChatClient = Depends(get_chat_port),
    conversation_words_repository: GoogleSheetsConversationWordsRepository = Depends(
        get_conversation_words_repository
    ),
):
    language_pair = _parse_lang(payload.lang.strip() or "pt-en")
    level = payload.level.strip().upper()
    if level not in CEFR_LEVELS:
        return JSONResponse(status_code=400, content={"error": f"invalid 'level': must be one of {sorted(CEFR_LEVELS)}"})
    message = payload.message.strip()
    if not message:
        return JSONResponse(status_code=400, content={"error": "missing 'message'"})

    history = [(turn.role, turn.content) for turn in payload.history[-CHAT_HISTORY_LIMIT:]]
    use_case = ChatWithAI(chat_port)
    reply = use_case.execute(history, message, level, language_pair.origin, language_pair.target)

    conversation_words: list[ConversationWordDTO] = []
    user = payload.user.strip()
    if user:
        try:
            email = Email(user)
            words = RecordConversationWords(conversation_words_repository).execute(
                email, language_pair, message
            )
            conversation_words = [
                ConversationWordDTO.from_entity(w) for w in words[:CONVERSATION_WORDS_LIMIT]
            ]
        except (ValueError, SheetsError):
            # Word tracking is a nice-to-have on top of the chat reply —
            # a malformed email or a flaky Sheets round trip shouldn't turn
            # a successful AI reply into a failed request.
            pass

    return ChatResponse(reply=reply, conversation_words=conversation_words)


@app.get("/tts")
def get_tts(
    text: str = "",
    lang: str = "en",
    tts_port: EdgeTtsClient = Depends(get_tts_port),
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


# vue-router runs in history mode, so a client-side route like /part/1/2
# is a real URL the browser can request directly (reload, deep link, PWA
# launch) — not just something reached by clicking inside the SPA. Every
# route above this one is matched first, so this only catches paths that
# aren't a known API endpoint or a static asset. Without it, those requests
# fell through to the StarletteHTTPException handler above and got the
# API's JSON {"error": "not found"} instead of the app shell, which is
# harmless when navigating client-side but breaks on a hard reload/deep
# link — exactly what happens more often on a real mobile browser than in
# desktop testing.
@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    return FileResponse(DIST_DIR / "index.html")
