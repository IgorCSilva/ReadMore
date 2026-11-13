## Create theme content

native: es
level: A1
roadmap directory: backend/content/learning/theme/health
chapter: EXE
topic: 7
output directory: <roadmap directory>/<chapter>_<topic>
target: fr


Based on the <roadmap directory>/roadmap.md, generate the content for the topic <topic> in chapter <chapter>. The content idiom level must be <level>. Structure the content to have a .md pattern.

Put the outcome in <output directory>/content_<level>.md

Update the Roadmap Table (progress tracker) status column to Done in <roadmap directory>/roadmap.md file.

### Translate the content

Like backend/content/es/learning/theme/health/NUT_1/es.json is an adapted content to backend/content/learning/theme/health/NUT_1/content_A1.md, adapt the current <roadmap directory>/<chapter>_<topic> content to create a backend/content/<target>/learning/theme/health/<chapter>_<topic>/<target>.json file.

### Add glossary data

Build glossary entries for every new word/expression this topic's <target>.json content
introduces, in the shared backend/content/<native>-<target>/glossary/glossary.json — the
same file "Add story" below uses for its own content, since both the Shadowing/learning
Study modal and the Stories Study modal draw from one pair-wide vocabulary file (see
backend/app/domain/glossary_words.py and
backend/app/infrastructure/repositories/json_learning_content_repository.py's docstrings).
Easy to forget since nothing in the earlier steps errors or even warns when this is
skipped — the topic loads and renders fine with an empty glossary, the gap only shows up
as missing Study-modal entries a learner would actually hit.

1. Read backend/content/<target>/learning/theme/<theme>/<chapter>_<topic>/<target>.json's
   `sentences` array (just written above) and tokenize it the same way
   domain.glossary_words.filter_glossary does: split on whitespace, strip leading/trailing
   non-word characters, lowercase, fold curly apostrophes to straight ones. Exclude bare
   numerals (e.g. "8", "12") — they're intentionally never glossed (see the existing file's
   own gaps for NUT_1/NUT_2).

2. Check which of those tokens are missing from
   backend/content/<native>-<target>/glossary/glossary.json (a flat
   {word_or_phrase: entry} map, keyed by exact normalized surface form — not lemma, so
   "bebe" and "bebas" each need their own entry even though they share a root "beber").

   Also check tokens that already HAVE an entry: read the entry's `meaning` and compare it
   against how the word is actually used in this topic's sentence. Spanish is full of
   homographs where the same surface form covers an unrelated sense — a noun vs. a
   conjugated verb form (e.g. "lata" the tin can vs. "lata" the subjunctive of "latir";
   "cocina" the kitchen vs. "Cocina" the imperative of "cocinar"; "cara" expensive vs.
   "cara" face; "cuenta" from "darse cuenta" vs. "cuenta" = "counts/matters"). If the
   existing single meaning doesn't cover the sense used here, don't overwrite it — expand
   it into a numbered multi-sense entry (see step 3b).

3. For each missing token, add an entry matching the file's existing schema exactly:

{
  "<word>": {
    "meaning": "<native-language meaning, with a short grammatical note for conjugated/
      non-dictionary forms, e.g. \"Bebe; imperativo/presente de 'beber'.\">",
    "examples": ["<one sentence pulled from this topic's own content>", "<one freshly
      written natural sentence>"],
    "synonyms": ["<target-language synonyms, or [] if none natural>"],
    "antonyms": ["<target-language antonyms, or [] if none natural>"]
  }
}

   Keep the merge additive — never remove or edit an existing key just because it looks
   like it could be improved; this file accumulates across every topic/story sharing the
   pair. The one exception is the homograph case from step 2: when a sense actually used
   here is missing from an existing entry, extend that entry rather than leaving the gap.

3b. To extend an existing entry with a new sense, renumber `meaning` and `examples` so
    each sense is tagged "(1)", "(2)", etc. — append the new sense as the next number and
    prefix every pre-existing example with "(1)" (do this even if the original entry had
    no numbering yet). Prefix `synonyms`/`antonyms` entries the same way whenever more than
    one sense has any. Pull at least one example for the new sense straight from this
    topic's own content. For example, turning a kitchen-only "cocina" entry into one that
    also covers the "Cocina el arroz..." imperative used in this topic:

{
  "cocina": {
    "meaning": "(1) Cozinha. (2) Cozinhe; imperativo de 'cocinar'.",
    "examples": [
      "(1) Toma un alimento empacado de tu cocina.",
      "(2) Cocina el arroz en agua por 20 minutos."
    ],
    "synonyms": [],
    "antonyms": []
  }
}

4. Re-sort the file's top-level keys alphabetically after merging (the file is maintained
   in sorted order) and write it back with the same ensure_ascii=False, indent=2 formatting
   as the existing file.

Output: the list of newly added glossary keys, any existing keys extended with a new
numbered sense (step 3b) and why, and confirmation no other existing key was altered.

### Affected files:

- backend/content/<native>-<target>/glossary/glossary.json

### Verify

Confirm every token in the new <target>.json's `sentences` (excluding bare numerals) now
resolves in backend/content/<native>-<target>/glossary/glossary.json. Then load the topic
through JsonLearningContentRepository.get_topic() for a pair using this target (not just
json.load) to confirm the new words actually surface in LearningTopic.glossary —
filter_glossary silently drops anything it can't match, so a plain file-level check isn't
enough.