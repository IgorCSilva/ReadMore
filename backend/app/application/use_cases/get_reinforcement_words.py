from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.services.reinforcement_words import reinforcement_words_by_tab
from backend.app.domain.value_objects import LanguagePair


class GetReinforcementWords:
    """word_ids carried over from earlier topics, split across the
    reinforcement tabs, for one chapter/topic. Uses the catalog's
    unfiltered chapter list — reinforcement selection is a pure function
    of curriculum position (see reinforcement_words_by_tab), not of which
    topics a given user has had enabled so far."""

    def __init__(self, catalog_repository: CatalogRepository) -> None:
        self._catalog_repository = catalog_repository

    def execute(
        self, lang: LanguagePair, chapter_number: int, topic_number: int
    ) -> dict[str, list[str]]:
        chapters = self._catalog_repository.get_chapters(lang)
        return reinforcement_words_by_tab(chapters, chapter_number, topic_number)
