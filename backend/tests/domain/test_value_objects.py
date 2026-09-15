import pytest

from backend.app.domain.value_objects import Email, LanguagePair, WordId


class TestEmail:
    def test_accepts_valid_email(self):
        assert str(Email("igor.carneiro@gmail.com")) == "igor.carneiro@gmail.com"

    @pytest.mark.parametrize(
        "value",
        ["", "not-an-email", "@gmail.com", "igor@", "igor@gmail", ".igor@gmail.com"],
    )
    def test_rejects_invalid_email(self, value):
        with pytest.raises(ValueError):
            Email(value)


class TestWordId:
    def test_accepts_non_empty_id(self):
        assert str(WordId("apple")) == "apple"

    def test_rejects_empty_id(self):
        with pytest.raises(ValueError):
            WordId("")


class TestLanguagePair:
    def test_accepts_distinct_origin_and_target(self):
        assert str(LanguagePair(origin="pt", target="en")) == "pt-en"

    def test_rejects_same_origin_and_target(self):
        with pytest.raises(ValueError):
            LanguagePair(origin="en", target="en")

    @pytest.mark.parametrize("origin,target", [("", "en"), ("pt", "")])
    def test_rejects_empty_language(self, origin, target):
        with pytest.raises(ValueError):
            LanguagePair(origin=origin, target=target)

    def test_parse_splits_on_first_hyphen(self):
        assert LanguagePair.parse("pt-en") == LanguagePair(origin="pt", target="en")

    def test_parse_rejects_a_bare_name_with_no_hyphen(self):
        with pytest.raises(ValueError):
            LanguagePair.parse("english")

    def test_parse_rejects_same_origin_and_target(self):
        with pytest.raises(ValueError):
            LanguagePair.parse("en-en")
