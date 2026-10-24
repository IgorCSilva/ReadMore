## Add mixed sentences

native: pt
target: es
chapter: 6
topic: 2

Create 100 natural sentences, following the exact pattern of chapter 1 topic 1's mixed_sentences.json in backend/content/pt-es/chapter_1/topic_1/mixed_sentences.json ({sentence_number, content} objects, target words marked with **bold**).

Rules:

Each words/expressions must appear (bolded) at least 5 times across the 100 sentences.
Whenever a sentence would otherwise contain a <native> word that has a <target> equivalent in backend/content/relations/<native>-<target>-relations.json — across the whole file, not just this topic — replace it with the bolded <target> word instead. Apply real <target> grammar when adapting, not a literal swap (e.g. la → el before a stressed-a feminine noun like agua; y → e only when the word immediately following starts with an i-/hi- sound, not just anywhere nearby in the sentence).
Never introduce <target> forms that aren't in the taught vocabulary (e.g. no al, las, los if only singular el/la have been taught) — rephrase instead of contracting.
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