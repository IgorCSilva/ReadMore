from backend.app.application.ports.corrections_repository import CorrectionsRepository
from backend.app.domain.exceptions import InvalidCorrectionError


def _clean(values: list[str]) -> list[str]:
    return [v.strip() for v in values if v.strip()]


class AddCorrection:
    def __init__(self, corrections_repository: CorrectionsRepository) -> None:
        self._corrections_repository = corrections_repository

    def execute(
        self,
        chapter_number: int,
        topic_number: int,
        lang: str,
        current: list[str],
        correction: list[str],
    ) -> None:
        cleaned_current = _clean(current)
        cleaned_correction = _clean(correction)
        if not cleaned_current or not cleaned_correction:
            raise InvalidCorrectionError("current and correction must each have at least one entry")

        self._corrections_repository.add_correction(
            chapter_number, topic_number, lang, cleaned_current, cleaned_correction
        )
