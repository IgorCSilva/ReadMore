from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.domain.entities import ProgressRecord, Word
from backend.app.domain.value_objects import Email, LanguagePair


class GetUserWords:
    """Words assigned to a user (i.e. present in their progress), each paired
    with its progress record. Words with no progress record are omitted —
    matches backend/server.py's handle_data filtering."""

    def __init__(
        self,
        catalog_repository: CatalogRepository,
        progress_repository: ProgressRepository,
    ) -> None:
        self._catalog_repository = catalog_repository
        self._progress_repository = progress_repository

    def execute(
        self,
        email: Email,
        lang: LanguagePair,
        sentence_lang: str = "target",
        cue_lang: str = "origin",
    ) -> list[tuple[Word, ProgressRecord]]:
        words = self._catalog_repository.get_words(lang, sentence_lang, cue_lang)
        progress = self._progress_repository.get_user_progress(email, lang)

        result = []
        for word in words:
            record = progress.get(word.word_id)
            if record is None:
                continue
            result.append((word, record))
        return result
