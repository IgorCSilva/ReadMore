from dataclasses import replace

from backend.app.application.ports.catalog_repository import CatalogRepository
from backend.app.application.ports.topics_repository import TopicsRepository
from backend.app.domain.entities import Chapter
from backend.app.domain.value_objects import Email


class GetChapters:
    """Chapters filtered to the topics enabled for a user. A chapter survives
    only if it still has at least one visible topic after filtering — matches
    backend/server.py's handle_chapters visibility rule."""

    def __init__(
        self,
        catalog_repository: CatalogRepository,
        topics_repository: TopicsRepository,
    ) -> None:
        self._catalog_repository = catalog_repository
        self._topics_repository = topics_repository

    def execute(self, email: Email, lang: str) -> list[Chapter]:
        chapters = self._catalog_repository.get_chapters(lang)
        enabled_topic_ids = self._topics_repository.get_enabled_topic_ids(email, lang)

        result = []
        for chapter in chapters:
            visible_topics = [t for t in chapter.topics if t.topic_id in enabled_topic_ids]
            if not visible_topics:
                continue
            result.append(replace(chapter, topics=visible_topics))
        return result
