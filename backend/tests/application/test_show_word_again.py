import pytest

from backend.app.application.ports.progress_repository import ProgressRepository
from backend.app.application.use_cases.show_word_again import ShowWordAgain
from backend.app.domain.entities import ProgressRecord
from backend.app.domain.exceptions import WordNotAssignedError
from backend.app.domain.value_objects import Email, LanguagePair

PT_EN = LanguagePair(origin="pt", target="en")


class FakeProgressRepository(ProgressRepository):
    def __init__(self, records: dict[str, ProgressRecord]) -> None:
        self._records = dict(records)
        self.upserted: list[ProgressRecord] = []

    def get_user_progress(self, email: Email, lang: LanguagePair) -> dict[str, ProgressRecord]:
        return dict(self._records)

    def upsert_progress(self, email: Email, lang: LanguagePair, record: ProgressRecord) -> None:
        self._records[record.word_id] = record
        self.upserted.append(record)


def test_marks_word_as_shown_again_and_persists_other_fields_unchanged():
    record = ProgressRecord(word_id="en-0001", confident=True, shown_count=7, show=False)
    repo = FakeProgressRepository({"en-0001": record})

    result = ShowWordAgain(repo).execute(Email("igor.carneiro@gmail.com"), PT_EN, "en-0001")

    assert result is True
    assert repo.upserted[-1] == ProgressRecord(
        word_id="en-0001", confident=True, shown_count=7, show=True
    )


def test_raises_for_word_not_assigned_to_user():
    repo = FakeProgressRepository({})

    with pytest.raises(WordNotAssignedError):
        ShowWordAgain(repo).execute(Email("igor.carneiro@gmail.com"), PT_EN, "en-9999")
