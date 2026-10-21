## Add vocabulary

idiom: es
chapter: 5
topic: 2

1. Resolve chapter/topic into a roadmap ID using the Section 7 table in
   contents/language_reading_journey_phases/roadmap.md (chapter 1 = its first
   chapter group, topic 1 = the first topic under it — e.g. chapter=1/topic=1
   → A0-EL-1, "Greetings & Introducing Yourself"). State the resolved ID and
   its objective before doing anything else.

2. Pull this topic's assignment from didactic_roadmap.md:
   - its thematic content, from roadmap.md's own topic description;
   - its structural items, from didactic_roadmap.md's "A0 — Per-Topic
     Breakdown" (or the matching level section if this falls outside A0/A1);
   - its word-count target, from didactic_roadmap.md's "Per-Topic
     Word-Count Targets" section — use that number, not a generic 15-20.

3. Adapt structural items to desired idiom specifically: didactic_roadmap.md's
   categories are language-agnostic, so drop anything that doesn't apply to
   desired idiom grammar (e.g. for English: gender-agreeing adjectives) and keep what does
   (e.g. for English: subject pronouns, "to be" conjugation, core connective "and", possessive
   adjectives, core wh-questions, etc., per the resolved topic's assignment).

4. Match backend/content/<idiom>/chapter_N/topic_N/words.json's existing schema exactly
   (a bare JSON array of strings).

5. De-duplication: before adding any word/expression, check it doesn't
   already exist (exact string match) anywhere else in <idiom>'s word lists — every other
   chapter/topic's words.json, not just earlier ones. Report explicitly if this check
   found nothing to exclude.

6. Expression completeness: if this topic's word list lets several already-listed
   words combine into a multi-word expression (e.g. "you" + "are" + "welcome"), check
   whether that combination shifts the meaning of any one of those words away from
   the sense it already carries on its own (e.g. bare "welcome" = response to
   "thank you", but "you are welcome" = has permission/is invited — a different
   sense of "welcome"). If it does, add the complete expression as its own entry in
   <idiom>/chapter_N/topic_N/words.json — never leave it as an implicit composition of the individual words,
   since downstream steps (relations, catalog concepts) would otherwise silently
   conflate the two senses under one word. If the combination doesn't change any
   component word's meaning (e.g. "good" + "morning" → "good morning" — an
   idiomatic greeting, but "good" and "morning" both keep their literal senses),
   it does not need its own entry.

  

Output: the updated words list for <idiom>/chapter_N/topic_N/words.json, and for each
added word/expression, a one-line reason tagged either [thematic] (from
roadmap.md), [structural] (from didactic_roadmap.md), or [sense-shift] (from step 6).

### Affected files:

- <idiom>/chapter_N/topic_N/words.json

### Verify

Confirm backend/content/<idiom>/chapter_N/topic_N/words.json actually exists on disk and
is valid JSON (a bare array of strings) before considering this step done — don't just
reason about what the list should contain.