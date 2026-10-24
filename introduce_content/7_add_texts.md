## Add texts

target: es
chapter: 6
topic: 2

Medium, standalone reading/shadowing passages for this chapter/topic — the content
backend/app/domain/entities.py's Topic.texts (texts.json) feeds to the frontend's Shadowing
tab (frontend/src/pages/ShadowingPage.vue): pure <target>-language text a learner reads
while listening to its TTS audio, unlike mixed_sentences.json's code-switched native-with-
bolded-<target>-words convention. There is no native-language relation to track here — like
content/<target>/chapter_N/topic_N/sentences.json, this lives under <target>'s own tree, not
a <native>-<target> pair directory, and takes no `native` input.

1. Resolve chapter/topic into a roadmap ID and CEFR level using the Section 7 table in
   roadmap/roadmap.md (chapter 1 = its first chapter group, topic 1 = the first topic under
   it — e.g. chapter=1/topic=1 → A0-EL-1, level A0, "Greetings & Introducing Yourself").
   State the resolved ID, level, and thematic objective before doing anything else.

2. Pull this level's grammar ceiling from roadmap/didactic_roadmap.md's per-level breakdown
   (e.g., A0 = simple present, no subordination) — every text must stay within that ceiling,
   same discipline "Add vocabulary" applies to word choice.

3. Write at least 6 medium texts (at least 3 sentences each) entirely in <target> — no
   <native> mixing anywhere in the body, unlike mixed_sentences.json. Vocabulary is NOT
   restricted to this chapter/topic's own words.json list: prioritize natural, idiomatic
   phrasing for the resolved topic's theme over strict vocabulary gating, pulling in any
   additional level-appropriate word needed to keep a sentence natural rather than
   contorting it to only taught words. Bold (**expression**) the phrases central to this
   topic's own theme wherever they appear in a text — the expressions a learner is meant to
   recognize and shadow — the same convention content/<target>/chapter_N/topic_N/
   sentences.json already uses for **bold** target words in context.

   Each text's title is written in <target> too, never in <native> — titles aren't exempt
   from the pure-<target> rule just because they're short.

   If contents/<native-language>_<target-language>/task_language_reading/texts/<level>/
   <roadmap-id>/ already holds a reference set of scenarios for this exact topic (authored
   for a different pair's mixed-language reading track), reuse its scenario ideas (who's
   talking, where, why) adapted into natural <target>-only dialogue/narration — don't reuse
   its sentences verbatim, since those are code-switched with <native> and this step's
   output must not be. If no such reference exists for this pair, invent scenarios fitting
   the topic's own theme instead.

4. Match the existing backend/content/<target>/chapter_N/topic_N/texts.json schema exactly:
   a bare JSON array of {text_id, number, title, body} objects (see
   backend/app/infrastructure/repositories/json_catalog_repository.py's _to_text), numbered
   starting at 1 in reading order, text_id formatted "<resolved-roadmap-id>-txt-<NN>"
   (two-digit, zero-padded — e.g. "top-A0-EL-1-txt-01").

   Before writing, check whether this chapter/topic's texts.json already exists — if it
   does, read it first and append new texts after the existing ones (continuing the number/
   text_id sequence from the current highest) rather than overwriting.

Output: the new/updated texts.json content for this chapter/topic, and the resolved roadmap
ID/level/theme stated at the start (step 1).

### Affected files:

- backend/content/<target>/chapter_N/topic_N/texts.json

### Verify

Confirm backend/content/<target>/chapter_N/topic_N/texts.json actually exists on disk (not
under a <native>-<target> pair directory — there is no native relation to track here), is
valid JSON, and every entry has exactly the keys {text_id, number, title, body}. Load it
through JsonCatalogRepository.get_chapters() for a pair using this target (not just
json.load) to confirm it actually reaches Topic.texts — a malformed schema or a misplaced
file (e.g. left under the pair tree out of habit) silently degrades to [] instead of
erroring (_load_texts/_load_optional_json), so a plain JSON-validity check alone isn't
enough. Spot-check at least one text: body is pure <target> with no stray native-language
words, and the title is in <target> too — both are easy mistakes to carry over from
mixed_sentences.json's style out of habit.
