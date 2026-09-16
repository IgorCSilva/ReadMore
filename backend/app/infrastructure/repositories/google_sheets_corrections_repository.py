"""GoogleSheetsCorrectionsRepository — reads/writes user-submitted content
corrections through the Google Apps Script "Web App" front end.

Backed by the shared "corrections" sheet tab (backend/apps-script/Code.gs):
one row per submitted correction, not scoped to a single user. Shared
HTTP/retry logic lives in GoogleSheetsClient.
"""
from backend.app.application.ports.corrections_repository import CorrectionsRepository
from backend.app.domain.entities import Correction
from backend.app.infrastructure.repositories.google_sheets_client import GoogleSheetsClient


def _split(raw: str) -> list[str]:
    return [part.strip() for part in str(raw).split(",") if part.strip()]


class GoogleSheetsCorrectionsRepository(GoogleSheetsClient, CorrectionsRepository):
    def list_corrections(self) -> list[Correction]:
        data = self._request("GET", params={"action": "get_corrections"})
        return [
            Correction(
                chapter_number=int(row.get("chapter_number", 0)),
                topic_number=int(row.get("topic_number", 0)),
                current=_split(row.get("current", "")),
                correction=_split(row.get("correction", "")),
            )
            for row in data.get("corrections", [])
        ]

    def add_correction(
        self,
        chapter_number: int,
        topic_number: int,
        lang: str,
        current: list[str],
        correction: list[str],
    ) -> None:
        self._request(
            "POST",
            body={
                "action": "add_correction",
                "chapter_number": chapter_number,
                "topic_number": topic_number,
                "lang": lang,
                "current": ", ".join(current),
                "correction": ", ".join(correction),
            },
        )
