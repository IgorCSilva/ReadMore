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


@dataclass
class GameObject:
    """One topic word's game-content mapping entry: what role that word_id
    plays in a game area. role is one of "dialogue", "noun", "interactable",
    "action", "spatial" — data holds role-specific extras (e.g. a dialogue
    role's {"line": "greeting"}) and stays untyped for now, same reasoning as
    Topic.exercises."""

    word_id: str
    role: str
    data: dict = field(default_factory=dict)


@dataclass
class GameArea:
    """A topic's playable area for one language pair: the topic's words as
    GameObjects, assembled by GetGameArea. Does not hold lang or email —
    those are the repository call's own parameters, same reasoning
    ProgressRecord doesn't hold email/lang either."""

    topic_id: str
    objects: list[GameObject] = field(default_factory=list)


@dataclass
class GameAction:
    """One player-submitted action for the command system (see
    GAME_ARCHITECTURE.md) — e.g. action_type="OPEN", target_word_id=<door's
    word_id>. target_word_id is None for actions with no target (e.g. MOVE)."""

    action_type: str
    target_word_id: str | None = None
    payload: dict = field(default_factory=dict)


@dataclass
class PlayerGameState:
    """One player's authoritative game state for one topic — mirrors a single
    (email, lang, topic_id) record in the future Sheets-backed game-state
    store, same reasoning ProgressRecord doesn't hold email/lang itself.
    discovered_word_ids/completed_interactions are plain sets of word_id /
    interaction-id strings; flags holds free-form puzzle/quest progress until
    a concrete puzzle shape exists to type it against."""

    topic_id: str
    discovered_word_ids: set[str] = field(default_factory=set)
    completed_interactions: set[str] = field(default_factory=set)
    flags: dict = field(default_factory=dict)
