"""Port (interface) for reading a user's own data from the "users" sheet.

Lives in application/, not infrastructure/ — see catalog_repository.py's
docstring for why.
"""
from abc import ABC, abstractmethod

from backend.app.domain.entities import UserRecord
from backend.app.domain.value_objects import Email


class UsersRepository(ABC):
    @abstractmethod
    def get_user(self, email: Email) -> UserRecord:
        """This email's own "users" sheet data — one round trip covering
        every field a caller might need about them, rather than one action
        per field."""
