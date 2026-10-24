## Add content in other files

native: pt
target: es
chapter: 6
topic: 2

Run the prompt in backend/prompts/phase_words_adaptation.md with origin=<native>,
target=<target>, chapter=<chapter>, topic=<topic>. It's already pair-agnostic — no
per-pair edits needed, just state the four inputs above when invoking it (it will ask
for any that are missing rather than assume). It reads
<target>/chapter_N/topic_N/words.json's word list for
this chapter/topic (already authored by "Add vocabulary" above), and will:

- Add words from backend/content/<target>/chapter_N/topic_N/words.json into
  backend/words/<target>_words.json — reusing an existing row instead of duplicating
  wherever this exact spelling is already present for <target>;
- Add words into backend/words/catalog.json — one language-agnostic row per genuinely
  new concept, with a fresh word_id past the catalog's current global maximum (never
  renumbered, never reused — see phase_words_adaptation.md's "Do not" section, since a
  live per-user Google Sheet references word_id by value);
- Add sentences into backend/words/sentences.json (target-language sentence with the
  word blanked out) and cues into backend/words/cues.json (origin-language descriptive
  cue, house style — not just the bare translation) for every genuinely-new
  (root_word_id, target) pairing;
- Add topic data and word ids into backend/content/<native>-<target>/chapter_N/topic_N/
  — creating the chapter/topic shell (info.json files, status "in_development") if it
  doesn't exist yet, then appending every resolved word_id to that topic's
  word_ids.json, in the word list's order;

This step does not touch backend/content/relations/<native>-<target>-relations.json —
that's built separately by the "Add relations" prompt above, run on its own.

Never let this step touch `texts.json` or `exercises.json` — words/catalog/sentences/cues
and the topic shell + word_ids.json only, per phase_words_adaptation.md's own scope.

### Affected files:

- backend/words/<target>_words.json
- backend/words/catalog.json
- backend/words/sentences.json
- backend/words/cues.json
- backend/content/<native>-<target>/chapter_N/topic_N/info.json
- backend/content/<native>-<target>/chapter_N/topic_N/word_ids.json

### Verify

Confirm every file listed above actually exists on disk and was actually updated — in
particular backend/content/<native>-<target>/chapter_N/topic_N/info.json and
word_ids.json. A topic directory that ends up with some files but not these two (e.g. only
a mixed_sentences.json written by a later step) will crash GET /chapters in production for
every user requesting this pair: JsonCatalogRepository._load_content loads each topic's
info.json unconditionally, with no missing-file fallback, unlike word_ids.json/
mixed_sentences.json/texts.json/exercises.json which all degrade to [] if absent. Do not
move on to "Add mixed sentences" until info.json and word_ids.json both exist for this
chapter/topic. Confirm that the words cues were added in cues.json file.
