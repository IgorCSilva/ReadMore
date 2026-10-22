## Create theme content

native: pt
level: A1
roadmap directory: backend/content/learning/theme/health
chapter: NUT
topic: 6
output directory: <roadmap directory>/<chapter>_<topic>
target: es


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

   Keep the merge additive — never remove or edit an existing key, even if it looks like it
   could be improved; this file accumulates across every topic/story sharing the pair.

4. Re-sort the file's top-level keys alphabetically after merging (the file is maintained
   in sorted order) and write it back with the same ensure_ascii=False, indent=2 formatting
   as the existing file.

Output: the list of newly added glossary keys, and confirmation no existing key was
altered.

### Affected files:

- backend/content/<native>-<target>/glossary/glossary.json

### Verify

Confirm every token in the new <target>.json's `sentences` (excluding bare numerals) now
resolves in backend/content/<native>-<target>/glossary/glossary.json. Then load the topic
through JsonLearningContentRepository.get_topic() for a pair using this target (not just
json.load) to confirm the new words actually surface in LearningTopic.glossary —
filter_glossary silently drops anything it can't match, so a plain file-level check isn't
enough.