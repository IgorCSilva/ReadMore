"""Korean particle-allomorph selection.

Several Korean particles have two written forms, chosen by whether the
syllable they attach to ends in a consonant (has a "batchim") or a vowel —
e.g. "and" is 와 after a vowel-final word but 과 after a consonant-final one.
This is pure Hangul-syllable phonology, decidable from Unicode codepoints
alone (see has_batchim), so it never needs to be judged by eye.

Crucially, the word a particle attaches to is always its KOREAN form, even
when that word is still displayed in the origin language in a mixed
sentence (e.g. Portuguese "maçã" hosting a Korean particle before "maçã"
itself is taught as Korean vocabulary). Content authoring must look up that
Korean form (see content/relations/pt-ko-relations.json) and pass it here —
never infer batchim from the origin-language spelling. That keeps the
particle choice correct from the first sentence it appears in, and stable
once the host word is later taught for real.
"""

_HANGUL_BASE = 0xAC00
_HANGUL_LAST = 0xD7A3
_FINAL_COUNT = 28


def has_batchim(korean_word: str) -> bool:
    """Whether korean_word's last syllable ends in a consonant (batchim).

    Raises ValueError if the word doesn't end in a precomposed Hangul
    syllable (empty string, or ends in Latin text/punctuation)."""
    if not korean_word:
        raise ValueError("korean_word must not be empty")
    last_codepoint = ord(korean_word[-1])
    if not (_HANGUL_BASE <= last_codepoint <= _HANGUL_LAST):
        raise ValueError(f"{korean_word!r} does not end in a Hangul syllable")
    final_index = (last_codepoint - _HANGUL_BASE) % _FINAL_COUNT
    return final_index != 0


def select_particle(korean_word: str, *, no_batchim: str, batchim: str) -> str:
    """Picks the allomorph of a batchim-conditioned particle for the word
    it will attach to, e.g.
    select_particle("사과", no_batchim="랑", batchim="이랑") -> "랑"."""
    return batchim if has_batchim(korean_word) else no_batchim


_ADDITION_PARTICLE_FORMS = {
    "casual": ("랑", "이랑"),
    "written": ("와", "과"),
}


def select_addition_particle(korean_word: str, *, register: str = "casual") -> str:
    """The Korean "and (between two nouns)" particle for korean_word, in
    the given register ("casual": 랑/이랑, or "written": 와/과).

    Defaults to "casual" because the pt-ko course register is 해요체
    (polite-informal spoken), decided in steps_to_introduce_content.md's
    "VERSION: pt-ko" section — 랑/이랑 matches that register's tone,
    while 와/과 leans literary/written."""
    no_batchim, batchim = _ADDITION_PARTICLE_FORMS[register]
    return select_particle(korean_word, no_batchim=no_batchim, batchim=batchim)
