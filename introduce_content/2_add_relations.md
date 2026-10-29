## Add relations

native: es

Check introduce_content/current_info.md file to know the target idiom, chapter and topic numbers.

file: backend/content/<target>/chapter_<N>/topic_<M>/words.json

Build the reverse-lookup relations for this chapter/topic in
backend/content/relations/<native>-<target>-relations.json, matching the existing nested shape:

{
  "chapter_<N>": {
    "topic_<M>": {
      "<native>": {
        "<native_word_or_expression>": "<idiom_equivalent>" | ["<idiom_option_1>", "<idiom_option_2>"]
      }
    }
  }
}

A value is always one or more COMPLETE, whole-expression equivalents of the
native key — never a decomposition into separate idiom words. If the native
key is a multi-word expression (e.g. "bom dia"), the value is the single
composed idiom phrase that expresses it (e.g. "good morning"), not an array
of its parts (never ["good", "morning"]) — even when that composed phrase
isn't itself a stored token in <target>'s own chapter_<N>/topic_<M>/words.json, as long as every word inside it
is. An array is only for genuinely distinct alternative equivalents — cases
where the native word/expression could correctly go to more than one whole
idiom form depending on context (e.g. "está" → ["are", "is"]; "noite",
ambiguous between "evening" and "night" in Portuguese, → ["evening",
"night"]; "boa noite" → ["good evening", "good night"]). If you're not sure
whether something is a decomposition or a genuine alternative, it's a
decomposition — compose it into one string instead.

1. Before writing, check whether the target relations file already exists.
   If it does, read it first. If its content looks wrong for the stated
   pair (wrong script/characters for <target>, e.g. Korean under a "-en-"
   filename), flag it explicitly as a bug to fix, not something to build on
   top of.

2. For each word/expression in <native>'s words.json list for this chapter/topic,
   find its complete equivalent(s), composed from words that literally
   appear in <file>'s list for this same chapter/topic — not a free
   translation, and not restricted to a single literal token when the
   natural equivalent is itself a short phrase (e.g. "de nada" → "you are
   welcome", composed from "you"/"are"/"welcome", all separately taught).
   No key outside <native>'s own words.json list for this chapter/topic; every
   word inside a value must come from <file>'s own list for this
   chapter/topic.

3. Grammatical form must match between key and value for verbs: if the native
   key is an infinitive, the idiom value must be the infinitive too, never a
   conjugated form (and vice versa — if the native key is conjugated for a
   specific person/tense, the value must be conjugated the same way). Don't
   settle for a same-lexeme-different-form value (e.g. native infinitive
   "correr" → idiom conjugated "corre") just because that's the only form
   currently in <file>'s list — that's a gap to close via rule 5, not an
   acceptable "functional, slightly-loose" match.

4. If a native word/expression has no equivalent that
   can be composed from <file>'s current list, that is a vocabulary gap in
   <target>'s own words.json, not a reason to skip the relation: add the
   missing word (in the correct grammatical form per rule 4) to
   <target>/chapter_N/topic_N/words.json first, then map it. Only leave a
   native word unmapped, and flag it explicitly in your report, if you
   cannot find or construct any reasonable idiom word for the concept at
   all — this should be rare, not the default outcome. Merge into the
   relations file — preserve every other chapter/topic already present
   untouched. If closing gaps grows <target>'s word count past this topic's
   didactic_roadmap.md target, say so explicitly in your report rather than
   silently exceeding it.

Output: the new/updated chapter_<N>/topic_<M> relations block, the
new/updated chapter_<N>/topic_<M> words.json if any words were added to close
a gap, and a one-line flag for any native word left with no idiom equivalent
at all (so it's a recorded, deliberate gap, not silently dropped).

### Affected files:

- backend/content/relations/<native>-<target>-relations.json
- <target>/chapter_<N>/topic_<M>/words.json, if building the relations exposes a genuine vocabulary gap
  (e.g. a native word with two distinct senses that the idiom list only
  covers one of) — fix the gap there first, then continue.

### Verify

Confirm backend/content/relations/<native>-<target>-relations.json actually exists on disk
and its chapter_<N>.topic_<M> block has exactly as many entries as <native>'s
chapter_<N>/topic_<M>/words.json has words/expressions (per rule 5's full-coverage
requirement) — and, if a gap was closed, that <target>/chapter_<N>/topic_<M>/words.json was
actually written to disk with the added word, not just described in your report.
