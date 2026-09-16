import pytest

from backend.app.application.ports.corrections_repository import CorrectionsRepository
from backend.app.application.use_cases.add_correction import AddCorrection
from backend.app.domain.exceptions import InvalidCorrectionError


class FakeCorrectionsRepository(CorrectionsRepository):
    def __init__(self) -> None:
        self.added: list[tuple] = []

    def list_corrections(self):
        raise NotImplementedError

    def add_correction(self, chapter_number, topic_number, lang, current, correction) -> None:
        self.added.append((chapter_number, topic_number, lang, current, correction))


def test_trims_whitespace_and_drops_empty_entries():
    repository = FakeCorrectionsRepository()
    use_case = AddCorrection(repository)

    use_case.execute(2, 4, "pt-es", [" avó ", ""], ["abuela", "  "])

    assert repository.added == [(2, 4, "pt-es", ["avó"], ["abuela"])]


def test_raises_when_current_is_empty_after_trimming():
    use_case = AddCorrection(FakeCorrectionsRepository())

    with pytest.raises(InvalidCorrectionError):
        use_case.execute(2, 4, "pt-es", ["  "], ["abuela"])


def test_raises_when_correction_is_empty_after_trimming():
    use_case = AddCorrection(FakeCorrectionsRepository())

    with pytest.raises(InvalidCorrectionError):
        use_case.execute(2, 4, "pt-es", ["avó"], [])


def test_preserves_case_and_supports_multiple_variants():
    repository = FakeCorrectionsRepository()
    use_case = AddCorrection(repository)

    use_case.execute(1, 1, "pt-es", ["meu", "minha"], ["mi"])

    assert repository.added == [(1, 1, "pt-es", ["meu", "minha"], ["mi"])]
