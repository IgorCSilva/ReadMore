import pytest

from backend.app.domain.exceptions import LanguageNotFoundError
from backend.app.domain.value_objects import LanguagePair
from backend.app.infrastructure.legacy_language_names import (
    parse_language_pair,
    to_legacy_name,
)


class TestParseLanguagePair:
    def test_resolves_a_legacy_name_to_its_pair(self):
        assert parse_language_pair("english") == LanguagePair(origin="pt", target="en")
        assert parse_language_pair("spanish") == LanguagePair(origin="pt", target="es")

    def test_resolves_a_pair_key_directly(self):
        assert parse_language_pair("pt-en") == LanguagePair(origin="pt", target="en")

    def test_raises_language_not_found_for_unrecognized_input(self):
        with pytest.raises(LanguageNotFoundError):
            parse_language_pair("klingon")


class TestToLegacyName:
    def test_maps_a_known_pair_back_to_its_legacy_name(self):
        assert to_legacy_name(LanguagePair(origin="pt", target="en")) == "english"
        assert to_legacy_name(LanguagePair(origin="pt", target="es")) == "spanish"

    def test_falls_back_to_the_pair_key_for_an_unmapped_pair(self):
        assert to_legacy_name(LanguagePair(origin="fr", target="de")) == "fr-de"
