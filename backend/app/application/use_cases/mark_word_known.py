from dataclasses import replace

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.application.services.enabled_words import enabled_word_ids
from backend.app.domain.entities import ProgressRecord
from backend.app.domain.exceptions import WordNotAssignedError
from backend.app.domain.value_objects import Email, LanguagePair


class MarkWordKnown:
    def __init__(
        self,
        catalog_repository: CatalogRepository,
        topics_repository: TopicsRepository,
        progress_repository: ProgressRepository,
    ) -> None:
        self._catalog_repository = catalog_repository
        self._topics_repository = topics_repository
        self._progress_repository = progress_repository

    def execute(self, email: Email, lang: LanguagePair, word_id: str) -> bool:
        chapters = self._catalog_repository.get_chapters(lang)
        enabled_topic_ids = self._topics_repository.get_enabled_topic_ids(email, lang)
        if word_id not in enabled_word_ids(chapters, enabled_topic_ids):
            raise WordNotAssignedError(word_id)

        progress = self._progress_repository.get_user_progress(email, lang)
        record = progress.get(word_id) or ProgressRecord(
            word_id=word_id, confident=False, shown_count=0, show=True
        )

        updated = replace(record, show=False)
        self._progress_repository.upsert_progress(email, lang, updated)
        return updated.show
