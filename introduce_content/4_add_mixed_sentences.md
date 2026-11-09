## Add mixed sentences

Check introduce_content/current_info.md file to know the native idiom, target idiom, chapter and topic numbers.

Create 100 natural sentences, following the exact pattern of chapter 1 topic 1's mixed_sentences.json in backend/content/pt-es/chapter_1/topic_1/mixed_sentences.json ({sentence_number, content} objects, target words marked with **bold**).

Rules:

Each words/expressions must appear (bolded) at least 5 times across the 100 sentences.
Whenever a sentence would otherwise contain a <native> word that has a <target> equivalent in backend/content/relations/<native>-<target>-relations.json — across the whole file, not just this topic — replace it with the bolded <target> word instead. Apply real <target> grammar when adapting, not a literal swap.
- If <target> is es: la → el before a stressed-a feminine noun like agua; y → e only when the word immediately following starts with an i-/hi- sound, not just anywhere nearby in the sentence.
- If <target> is fr: elision is mandatory, not optional house style — le/la/de/que/ne/se/me/te/ce/je always collapse to l'/d'/qu'/n'/s'/m'/t'/c'/j' before a vowel sound or mute h (e.g. never bold "**le** ami", always "**l'**ami"); this applies even when the un-elided word is the one actually taught, since elision is an orthographic rule of French, not a separate vocabulary item. Contractions (à+le→au, à+les→aux, de+le→du, de+les→des) are NOT automatic the same way — treat them like es's al/del under the next rule: only use one if au/du/aux/des has itself already been taught as vocabulary, otherwise rephrase around it (e.g. keep "de le" apart as separate taught words, or restructure the sentence) rather than contracting into an untaught form.
- If <target> is ja: this is a grammar restructuring, not a word-for-word swap — Japanese is SOV, so the taught verb/adjective+です always moves to the end of the sentence, and any Portuguese word it displaces (typically the copula) is dropped rather than left stranded. Every particle (は/が/を/に/で/と/も) required by the Japanese portion must be present in its one invariant written form (no allomorphy to choose, unlike Korean's batchim particles) and glued directly onto its host with no space — Japanese has no spaces between words at all, same handling as Chinese. A counted noun takes its counter (人/匹/冊/個/...) between the number and the noun, chosen from the host word's Japanese form recorded in pt-ja-relations.json, never guessed from the Portuguese spelling or omitted even when the host noun isn't taught yet. Write the Japanese portion in hiragana/katakana only — no kanji, per the kana-only decision in "Add target idiom natural sentences".
Never introduce <target> forms that aren't in the taught vocabulary (e.g. no al, las, los if only singular el/la have been taught for es; no au/du/aux/des if only the uncontracted articles have been taught for fr; no untaught ja particle/counter/verb ending) — rephrase instead of contracting.

Reflexive verbs: a word taught as a bare infinitive without its own pronoun (per
1_add_vocabulary.md's convention — e.g. French catalog word "réveiller", not "se
réveiller"; Spanish catalog word "despertar", not "despertarse") needs that pronoun
supplied by YOU, in whatever person this sentence's own subject actually requires —
never default to the 3rd-person "se" just because that's the dictionary citation form.
A sentence whose governing verb is 1st person ("Procuro...", "Decidí...", "Necesito...")
takes "me" (fr/es), not "se"; a sentence governed by an impersonal/generic construction
("il faut...", "es necesario...") or an explicit 3rd-person subject correctly takes
"se". Bold the pronoun and the bare verb as two SEPARATE bold spans (e.g. "**me**
**réveiller**"), the same way an elided contraction is already split into two adjacent
spans elsewhere in this file (e.g. "**m'****habille**") — never re-merge them into one
"**se verbe**" span, since "se verbe" is no longer this word's own catalog spelling and
silently breaks the frontend's word-highlighting match (it looks fine, it just quietly
stops being clickable/matchable). If the pronoun elides before the verb (French m'/t'/s'
before a vowel or mute h), apply that same adjacent-bold convention: "**m'****habiller**".
This is exactly the es-fr chapter_1/topic_4 "se reposer" → "me reposer" bug this note was
written after — check_mixed_sentences_relations.py's literal vocabulary match cannot
catch a wrong-but-still-taught pronoun like "se" where "me" was needed, so this needs an
explicit manual read, same as the fr elision/contraction rules below.

Before finalizing, verify programmatically: exact sentence count, each word's occurrence count, no duplicate sentences, and no unbolded leftover word that had a mapped equivalent.

The sentences must be located in: backend/content/<native>-<target>/chapter_N/topic_N/mixed_sentences.json.


Then run the backend/scripts/shuffle_sentences.py script to shuffle sentences:
`python3 backend/scripts/shuffle_sentences.py {pair of idioms} {chapter number} {topic number}`

Then run backend/scripts/check_mixed_sentences_relations.py to catch two mistakes
that are easy to make by hand and easy to miss by eye: a native word left
unbolded even though it has a mapped <target> equivalent somewhere in
relations.json, and — more subtly — a **bolded** span that's actually still the
native word (a relations.json key) instead of its translated value (e.g.
"**ninguém**" left bolded as Portuguese instead of becoming "**nadie**", or
"**muito**" instead of "**mucho**"):
`python3 backend/scripts/check_mixed_sentences_relations.py <native>-<target> {chapter number} {topic number}`

If <target> is es, also run backend/scripts/check_es_grammar_adaptation.py to
verify the y/e and la/el grammar rules from the "Rules" above were actually
applied correctly, not just defaulted to one form everywhere (e.g. bolding
"**e**" throughout instead of "**y**", which relations.json's lookup alone
can't catch since "e" is a recorded value there too — this is a grammar check,
not a vocabulary check):
`python3 backend/scripts/check_es_grammar_adaptation.py <native>-es {chapter number} {topic number}`

If <target> is fr, there is no equivalent automated checker yet for the elision/contraction
rules above (check_fr_grammar_adaptation.py doesn't exist) — do a manual read-through of
every bolded French word/phrase instead: confirm each elidable word before a vowel/mute h is
actually written elided (l'/d'/qu'/...), and that no untaught au/du/aux/des contraction
slipped in. Flag to the user if this manual pass turns up enough recurring mistakes to be
worth building a dedicated script for.

If <target> is ja (or zh), also run backend/scripts/check_sentence_markers.py — `ja` is
already registered in its `_NO_SPACE_LANGUAGES`/`_RELIABLE_LANGUAGES` sets, so no script
changes are needed first. It catches a taught word/particle that leaked into a sentence
without `**bold**` markers at all, which a `\b`-anchored check would miss since Japanese
(like Chinese) has no spaces to anchor against:
`python3 backend/scripts/check_sentence_markers.py <native>-ja {chapter number} {topic number}`

Fix any reported mismatch before moving on. Note both scripts can only catch a
native word/rule they can already see evidence for — a concept whose native
word was never recorded as its own relations.json key (e.g. "onde" taught in a
later chapter but only ever mapped as the compound "onde fica" → "dónde está",
never bare "onde" → "dónde") won't be found this way; that's a relations.json
coverage gap, not a lookup failure, and still needs a human read-through.

### Affected files:

- backend/content/<native>-<target>/chapter_N/topic_N/mixed_sentences.json

### Verify

Before running this step, confirm backend/content/<native>-<target>/chapter_N/topic_N/
info.json and word_ids.json already exist (they're created by "Add content in other
files" above, which must run first). This step only ever writes mixed_sentences.json
itself — it must never be the step that creates a topic directory from scratch, since a
topic directory holding mixed_sentences.json but no info.json crashes GET /chapters in
production (see the "Add content in other files" Verify note above). If info.json/
word_ids.json don't exist yet, stop and run "Add content in other files" first instead of
proceeding.