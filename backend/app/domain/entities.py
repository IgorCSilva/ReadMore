"""Domain entities — have identity, plain dataclasses, no I/O.

Field shapes mirror catalog.json's current schema (documented in
backend/server.py's module docstring) so the catalog repository (later
steps) can map 1:1 without translation. Topic.exercises stays untyped
(list[dict]) for now — modeling it is out of scope for this step.
"""
from dataclasses import dataclass, field


@dataclass
class Word:
    word_id: str
    original: str
    filename: str
    sentence: str
    cue: str
    # Contextual example sentence (origin language, target word **bolded**)
    # shown under the word on the teaching flow's first page — authored per
    # chapter/topic under content/auxiliar_sentences/ as each topic's content
    # is written, so most words don't have one yet and default to "".
    auxiliar_sentence: str = ""
    # Romanization shown under the word on the teaching flow's first page —
    # only Chinese words have one so far; every other language's rows simply
    # have no "pinyin" key in their <target>_words.json, which resolves to
    # "" here rather than a language-specific default.
    pinyin: str = ""
    gender_id: str = "not_apply"
    # Which Korean particle category ("topic", "subject", "object",
    # "addition", ...) this word is, for the frontend's dedicated
    # particle-color palette (shared/koreanParticles.ts) — unset/"not_apply"
    # for every non-particle word in every language, same convention as
    # gender_id above.
    particle_type: str = "not_apply"


@dataclass
class Text:
    text_id: str
    number: int
    title: str
    body: str


@dataclass
class Sentence:
    sentence_number: int
    content: str


@dataclass
class Phrase:
    """A standalone, natural target-language sentence (unlike Sentence,
    which is an origin-language sentence with **bolded** target words) —
    sourced from content/<target>/chapter_N/topic_N/sentences.json, used by
    the reinforcement "listen and pick the known words" tab. word_ids lists
    every topic word present in the sentence, in the order it appears."""

    id: str
    sentence: str
    word_ids: list[str]


@dataclass
class Topic:
    topic_id: str
    number: int
    title: str
    description: str
    word_ids: list[str]
    texts: list[Text] = field(default_factory=list)
    sentences: list[Sentence] = field(default_factory=list)
    phrases: list[Phrase] = field(default_factory=list)
    status: str = "ready"
    exercises: list[dict] = field(default_factory=list)


@dataclass
class Chapter:
    chapter_id: str
    number: int
    title: str
    description: str
    topics: list[Topic] = field(default_factory=list)
    status: str = "ready"


@dataclass
class ProgressRecord:
    """One user's progress on one word, for one language: mirrors a single
    (email, lang, word_id) row in the Sheets-backed progress store."""

    word_id: str
    confident: bool
    shown_count: int
    show: bool


@dataclass
class ConversationWordUsage:
    """One user's usage count for one target-language word, from their own
    "<email>-<target>-progress" sheet (seeded by hand, not auto-created —
    see Code.gs's schema comment). Tracks how many times the word has
    appeared in something the user typed in the AI conversation feature, so
    the conversation page can surface the words they've practiced least."""

    word_id: str
    word: str
    quantity: int


@dataclass
class UserRecord:
    """One user's own data from the "users" sheet: whether they're
    registered at all, and which language pairs are active for them (per
    row in that sheet, active even when its topic_ids is empty — see
    Code.gs's schema comment). Grows more fields here, not more sheet
    actions/routes, as later features need more of a user's own data."""

    exists: bool
    language_pairs: frozenset[str]


@dataclass
class GlossaryEntry:
    """One word's (or phrase's — e.g. "método del plato") study info for the
    "Study" modal shared by Stories and LearningTopic — meaning is in the
    pair's origin language (what's being explained to the learner);
    examples/synonyms/antonyms are in the target language (what's being
    learned, and what gets played back through TTS)."""

    meaning: str
    examples: list[str] = field(default_factory=list)
    synonyms: list[str] = field(default_factory=list)
    antonyms: list[str] = field(default_factory=list)


@dataclass
class StorySummary:
    """Listing-weight story info — just enough for /api/stories to group every
    story by level without shipping each one's full glossary."""

    story_id: str
    title: str
    level: str


@dataclass
class Story(StorySummary):
    """A full extensive-reading story: sentences (re-segmented from the
    source poem/text into real grammatical units, not lines) plus a
    glossary keyed by normalized word (lowercased, outer punctuation
    stripped) covering every word that appears in `sentences`."""

    sentences: list[str] = field(default_factory=list)
    glossary: dict[str, GlossaryEntry] = field(default_factory=dict)


@dataclass
class LearningTopicSummary:
    """Listing-weight info for one theme/learning content — just enough for
    /api/learning-topics to group every topic by theme without shipping its
    full sentences."""

    topic_id: str
    theme: str
    title: str
    level: str


@dataclass
class LearningTopic(LearningTopicSummary):
    """A full learning-theme topic: plain-language content (e.g. Nutrition's
    "Macronutrients Basics") written directly in the target language, no
    origin-language mixing in `sentences` itself. `glossary` is the
    pair-specific Study overlay (same shape/semantics as Story.glossary,
    including phrase keys like "método del plato") so this content's reader
    page can offer the same "Study" button Stories has."""

    sentences: list[str] = field(default_factory=list)
    glossary: dict[str, GlossaryEntry] = field(default_factory=dict)


@dataclass
class Correction:
    """A user-submitted current->correction report, scoped to the chapter
    and topic it was made in. current/correction each hold one or more
    variant strings (N->N mapping, e.g. "meu"/"minha" both -> "mi")."""

    chapter_number: int
    topic_number: int
    current: list[str]
    correction: list[str]
