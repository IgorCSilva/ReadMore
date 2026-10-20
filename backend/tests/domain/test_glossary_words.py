from backend.app.domain.glossary_words import filter_glossary

GLOSSARY = {
    "rain": {"meaning": "Chuva."},
    "sun": {"meaning": "Sol."},
    "método del plato": {"meaning": "Uma técnica para equilibrar o prato."},
    "método": {"meaning": "Um jeito de fazer algo."},
}


def test_keeps_single_word_entries_appearing_in_sentences():
    result = filter_glossary(GLOSSARY, ["Rain fell."])

    assert set(result) == {"rain"}


def test_drops_single_word_entries_not_appearing_in_sentences():
    result = filter_glossary(GLOSSARY, ["Rain fell."])

    assert "sun" not in result


def test_matches_multi_word_phrase_as_contiguous_run_of_tokens():
    result = filter_glossary(GLOSSARY, ["Usa el método del plato."])

    assert "método del plato" in result
    # The phrase's own words also appear on their own in the text, but only
    # the standalone "método" key (not part of the matched phrase) should
    # independently match too — both are legitimately present.
    assert "método" in result


def test_does_not_match_phrase_words_out_of_order_or_non_contiguous():
    result = filter_glossary(GLOSSARY, ["El plato tiene un método distinto."])

    assert "método del plato" not in result
    assert "método" in result
