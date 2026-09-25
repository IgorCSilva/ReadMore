import pytest

from backend.app.domain.korean_particles import (
    has_batchim,
    select_addition_particle,
    select_particle,
)


def test_has_batchim_false_for_vowel_final_syllable():
    assert has_batchim("사과") is False  # apple — ends in 과, no final consonant


def test_has_batchim_true_for_consonant_final_syllable():
    assert has_batchim("책") is True  # book — ends in ㄱ batchim


def test_has_batchim_rejects_non_hangul():
    with pytest.raises(ValueError):
        has_batchim("maçã")


def test_has_batchim_rejects_empty_string():
    with pytest.raises(ValueError):
        has_batchim("")


def test_select_particle_uses_the_words_own_ending():
    assert select_particle("사과", no_batchim="랑", batchim="이랑") == "랑"
    assert select_particle("책", no_batchim="랑", batchim="이랑") == "이랑"


def test_select_addition_particle_casual_register():
    assert select_addition_particle("사과", register="casual") == "랑"
    assert select_addition_particle("책", register="casual") == "이랑"


def test_select_addition_particle_written_register():
    assert select_addition_particle("사과", register="written") == "와"
    assert select_addition_particle("책", register="written") == "과"
