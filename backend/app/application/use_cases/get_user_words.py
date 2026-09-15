from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.application.services.enabled_words import enabled_word_ids
from backend.app.domain.entities import ProgressRecord, Word
from backend.app.domain.value_objects import Email, LanguagePair


class GetUserWords:
    """Words belonging to a topic enabled for the user, each paired with its
    progress record — a default (never shown, not confident) one for a word
    that has no progress row yet, since enabling now lives at the topic
    level rather than requiring a pre-existing progress row per word."""

    def __init__(
        self,
        catalog_repository: CatalogRepository,
        progress_repository: ProgressRepository,
        topics_repository: TopicsRepository,
    ) -> None:
        self._catalog_repository = catalog_repository
        self._progress_repository = progress_repository
        self._topics_repository = topics_repository

    def execute(
        self,
        email: Email,
        lang: LanguagePair,
        sentence_lang: str = "target",
        cue_lang: str = "origin",
    ) -> list[tuple[Word, ProgressRecord]]:
        words = self._catalog_repository.get_words(lang, sentence_lang, cue_lang)
        chapters = self._catalog_repository.get_chapters(lang)
        enabled_topic_ids = self._topics_repository.get_enabled_topic_ids(email, lang)
        enabled_ids = enabled_word_ids(chapters, enabled_topic_ids)

        progress = self._progress_repository.get_user_progress(email, lang)

        result = []
        for word in words:
            if word.word_id not in enabled_ids:
                continue
            record = progress.get(word.word_id) or ProgressRecord(
                word_id=word.word_id, confident=False, shown_count=0, show=True
            )
            result.append((word, record))
        return result
