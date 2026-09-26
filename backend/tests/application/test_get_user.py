from backend.app.application.ports.users_repository import UsersRepository
from backend.app.application.use_cases.get_user import GetUser
from backend.app.domain.entities import UserRecord
from backend.app.domain.value_objects import Email


class FakeUsersRepository(UsersRepository):
    def __init__(self, users_by_email: dict[str, UserRecord]) -> None:
        self._users_by_email = users_by_email

    def get_user(self, email: Email) -> UserRecord:
        return self._users_by_email.get(
            str(email), UserRecord(exists=False, language_pairs=frozenset())
        )


def test_returns_the_matching_users_record():
    record = UserRecord(exists=True, language_pairs=frozenset({"pt-en", "pt-es"}))
    use_case = GetUser(FakeUsersRepository({"igor.carneiro@gmail.com": record}))

    assert use_case.execute(Email("igor.carneiro@gmail.com")) == record


def test_returns_a_non_existent_record_for_an_unknown_email():
    use_case = GetUser(FakeUsersRepository({}))

    result = use_case.execute(Email("nobody@gmail.com"))

    assert result.exists is False
    assert result.language_pairs == frozenset()
