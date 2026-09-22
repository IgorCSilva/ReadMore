from backend.app.domain.entities import (
    Chapter,
    GameAction,
    GameArea,
    GameObject,
    PlayerGameState,
    ProgressRecord,
    Text,
    Topic,
    Word,
)


def test_word_holds_catalog_fields():
    word = Word(
        word_id="en-0001",
        original="hello",
        filename="hello.webp",
        sentence="Hello, how are you?",
        cue="\U0001F44B",
        gender_id="not_apply",
    )
    assert word.word_id == "en-0001"
    assert word.original == "hello"
    assert word.filename == "hello.webp"
    assert word.sentence == "Hello, how are you?"
    assert word.cue == "\U0001F44B"
    assert word.gender_id == "not_apply"


def test_word_defaults_gender_id_to_not_apply():
    word = Word(
        word_id="en-0001",
        original="hello",
        filename="hello.webp",
        sentence="Hello, how are you?",
        cue="\U0001F44B",
    )
    assert word.gender_id == "not_apply"


def test_text_holds_catalog_fields():
    text = Text(text_id="txt-01", number=1, title="A Perfect Morning", body="**I** **am**")
    assert text.text_id == "txt-01"
    assert text.number == 1
    assert text.title == "A Perfect Morning"
    assert text.body == "**I** **am**"


def test_topic_holds_catalog_fields_and_defaults():
    topic = Topic(
        topic_id="top-01",
        number=1,
        title="Greetings",
        description="Basic greetings",
        word_ids=["en-0001", "en-0002"],
    )
    assert topic.topic_id == "top-01"
    assert topic.word_ids == ["en-0001", "en-0002"]
    assert topic.texts == []
    assert topic.status == "ready"
    assert topic.exercises == []


def test_topic_can_hold_texts_and_in_development_status():
    text = Text(text_id="txt-01", number=1, title="T", body="B")
    topic = Topic(
        topic_id="top-02",
        number=2,
        title="Numbers",
        description="Counting",
        word_ids=["en-0003"],
        texts=[text],
        status="in_development",
    )
    assert topic.texts == [text]
    assert topic.status == "in_development"


def test_chapter_holds_catalog_fields_and_defaults():
    chapter = Chapter(
        chapter_id="ch-01",
        number=1,
        title="Getting Started",
        description="Intro chapter",
    )
    assert chapter.chapter_id == "ch-01"
    assert chapter.topics == []
    assert chapter.status == "ready"


def test_chapter_can_hold_topics():
    topic = Topic(
        topic_id="top-01",
        number=1,
        title="Greetings",
        description="Basic greetings",
        word_ids=["en-0001"],
    )
    chapter = Chapter(
        chapter_id="ch-01",
        number=1,
        title="Getting Started",
        description="Intro",
        topics=[topic],
    )
    assert chapter.topics == [topic]


def test_progress_record_holds_catalog_fields():
    record = ProgressRecord(word_id="en-0001", confident=False, shown_count=3, show=True)
    assert record.word_id == "en-0001"
    assert record.confident is False
    assert record.shown_count == 3
    assert record.show is True


def test_game_object_defaults_data_to_empty_dict():
    obj = GameObject(word_id="en-0001", role="dialogue")
    assert obj.word_id == "en-0001"
    assert obj.role == "dialogue"
    assert obj.data == {}


def test_game_object_holds_role_specific_data():
    obj = GameObject(word_id="en-0001", role="dialogue", data={"line": "greeting"})
    assert obj.data == {"line": "greeting"}


def test_game_area_defaults_objects_to_empty_list():
    area = GameArea(topic_id="top-01")
    assert area.topic_id == "top-01"
    assert area.objects == []


def test_game_area_can_hold_objects():
    obj = GameObject(word_id="en-0001", role="dialogue")
    area = GameArea(topic_id="top-01", objects=[obj])
    assert area.objects == [obj]


def test_game_action_defaults_target_and_payload():
    action = GameAction(action_type="MOVE")
    assert action.action_type == "MOVE"
    assert action.target_word_id is None
    assert action.payload == {}


def test_game_action_holds_target_and_payload():
    action = GameAction(action_type="OPEN", target_word_id="en-0002", payload={"dir": "north"})
    assert action.target_word_id == "en-0002"
    assert action.payload == {"dir": "north"}


def test_player_game_state_defaults_to_empty_progress():
    state = PlayerGameState(topic_id="top-01")
    assert state.topic_id == "top-01"
    assert state.discovered_word_ids == set()
    assert state.completed_interactions == set()
    assert state.flags == {}


def test_player_game_state_can_hold_progress():
    state = PlayerGameState(
        topic_id="top-01",
        discovered_word_ids={"en-0001"},
        completed_interactions={"intro-dialogue"},
        flags={"quest_started": True},
    )
    assert state.discovered_word_ids == {"en-0001"}
    assert state.completed_interactions == {"intro-dialogue"}
    assert state.flags == {"quest_started": True}
