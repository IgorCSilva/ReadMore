from dataclasses import replace

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.corrections_repository import CorrectionsRepository
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.application.services.corrections import apply_corrections
from backend.app.domain.entities import Chapter
from backend.app.domain.value_objects import Email, LanguagePair


class GetChapters:
    """Chapters filtered to the topics enabled for a user, with any
    user-submitted corrections (see application/services/corrections.py)
    applied to the surviving topics' texts/exercises. A chapter survives
    only if it still has at least one visible topic after filtering — matches
    backend/server.py's handle_chapters visibility rule."""

    def __init__(
        self,
        catalog_repository: CatalogRepository,
        topics_repository: TopicsRepository,
        corrections_repository: CorrectionsRepository,
    ) -> None:
        self._catalog_repository = catalog_repository
        self._topics_repository = topics_repository
        self._corrections_repository = corrections_repository

    def execute(self, email: Email, lang: LanguagePair) -> list[Chapter]:
        chapters = self._catalog_repository.get_chapters(lang)
        enabled_topic_ids = self._topics_repository.get_enabled_topic_ids(email, lang)

        result = []
        for chapter in chapters:
            visible_topics = [t for t in chapter.topics if t.topic_id in enabled_topic_ids]
            if not visible_topics:
                continue
            result.append(replace(chapter, topics=visible_topics))

        try:
            corrections = self._corrections_repository.list_corrections()
        except Exception:
            # Corrections are an optional markup layer on top of the core
            # chapter/topic content (e.g. the corrections sheet tab/action
            # isn't provisioned yet). A failure fetching them must not take
            # down chapter delivery itself — the ported concrete repository
            # can raise whatever it wants here, so this stays broad rather
            # than depending on an infrastructure-specific exception type.
            corrections = []
        return apply_corrections(result, corrections, lang.target)
