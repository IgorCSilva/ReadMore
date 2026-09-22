import pytest

from backend.app.application.ports.game_content_repository import GameContentRepository
from backend.app.application.use_cases.get_game_area import GetGameArea
from backend.app.domain.entities import GameArea, GameObject
from backend.app.domain.exceptions import GameAreaNotFoundError
from backend.app.domain.value_objects import LanguagePair

PT_ES = LanguagePair(origin="pt", target="es")
PT_EN = LanguagePair(origin="pt", target="en")


class FakeGameContentRepository(GameContentRepository):
    def __init__(self, areas_by_lang_topic: dict[tuple[LanguagePair, str], GameArea]) -> None:
        self._areas_by_lang_topic = areas_by_lang_topic
        self.last_call: tuple[LanguagePair, str] | None = None

    def get_game_area(self, lang: LanguagePair, topic_id: str) -> GameArea:
        self.last_call = (lang, topic_id)
        key = (lang, topic_id)
        if key not in self._areas_by_lang_topic:
            raise GameAreaNotFoundError(topic_id)
        return self._areas_by_lang_topic[key]


def _area() -> GameArea:
    return GameArea(
        topic_id="top-A0-EL-1",
        objects=[GameObject(word_id="es-wd-0001", role="dialogue", data={"line": "greeting-formal"})],
    )


def test_returns_area_for_known_lang_and_topic():
    area = _area()
    use_case = GetGameArea(FakeGameContentRepository({(PT_ES, "top-A0-EL-1"): area}))

    assert use_case.execute(PT_ES, "top-A0-EL-1") == area


def test_forwards_lang_and_topic_id_to_the_repository():
    repository = FakeGameContentRepository({(PT_ES, "top-A0-EL-1"): _area()})
    use_case = GetGameArea(repository)

    use_case.execute(PT_ES, "top-A0-EL-1")

    assert repository.last_call == (PT_ES, "top-A0-EL-1")


def test_raises_for_unmapped_topic():
    use_case = GetGameArea(FakeGameContentRepository({}))

    with pytest.raises(GameAreaNotFoundError):
        use_case.execute(PT_EN, "top-A0-EL-1")
