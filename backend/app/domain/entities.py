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
    gender_id: str = "not_apply"


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
    sourced from content/<target>_sentences.json, used by the reinforcement
    "listen and pick the known words" tab. word_ids lists every topic word
    present in the sentence, in the order it appears."""

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
class Correction:
    """A user-submitted current->correction report, scoped to the chapter
    and topic it was made in. current/correction each hold one or more
    variant strings (N->N mapping, e.g. "meu"/"minha" both -> "mi")."""

    chapter_number: int
    topic_number: int
    current: list[str]
    correction: list[str]
