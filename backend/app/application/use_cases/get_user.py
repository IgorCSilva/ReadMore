from backend.app.application.ports.users_repository import UsersRepository
from backend.app.domain.entities import UserRecord
from backend.app.domain.value_objects import Email


class GetUser:
    def __init__(self, users_repository: UsersRepository) -> None:
        self._users_repository = users_repository

    def execute(self, email: Email) -> UserRecord:
        return self._users_repository.get_user(email)
