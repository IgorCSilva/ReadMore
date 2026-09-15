from dataclasses import replace

from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.domain.exceptions import WordNotAssignedError
from backend.app.domain.value_objects import Email, LanguagePair


class MarkWordKnown:
    def __init__(self, progress_repository: ProgressRepository) -> None:
        self._progress_repository = progress_repository

    def execute(self, email: Email, lang: LanguagePair, word_id: str) -> bool:
        progress = self._progress_repository.get_user_progress(email, lang)
        record = progress.get(word_id)
        if record is None:
            raise WordNotAssignedError(word_id)

        updated = replace(record, show=False)
        self._progress_repository.upsert_progress(email, lang, updated)
        return updated.show
