from backend.app.domain.entities import Chapter, ProgressRecord, Text, Topic, Word


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


def test_word_defaults_particle_type_to_not_apply():
    word = Word(
        word_id="ko-0001",
        original="사과",
        filename="apple.webp",
        sentence="사과가 맛있어요.",
        cue="Uma fruta redonda e doce.",
    )
    assert word.particle_type == "not_apply"


def test_word_holds_particle_type():
    word = Word(
        word_id="ko-0002",
        original="랑",
        filename="and.webp",
        sentence="사과랑 바나나를 먹어요.",
        cue="Partícula de adição usada entre dois substantivos.",
        particle_type="addition",
    )
    assert word.particle_type == "addition"


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
