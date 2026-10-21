## Add target idiom natural sentences

target: es
chapter: 5
topic: 3

Now, generate simple natural sentences, following the pattern in
backend/content/es/chapter_<chapter>/topic_<topic>/sentences.json.
For each word/expression, create 3 natural sentences.

- For Korean
Sentences with pure Korean, every conjugated verb in 해요체 per the register
decision.

- For Chinese
Sentences with pure Chinese, using casual 你 per the register decision and
only aspect particles/measure words already taught.

------------------------------------

Then run backend/scripts/check_sentence_word_ids.py to verify every word_id in
these new sentences actually matches a word present in its own sentence text —
nothing else in the pipeline catches a wrong-but-structurally-valid id (e.g. one
word's id used where a different word was meant, often by consulting the wrong
topic's word list while authoring). A mismatch here means the "Listen and
Identify" word-picker game will silently render fewer blanks than it should,
since it skips any word_id it can't find a text match for instead of erroring:
`python3 backend/scripts/check_sentence_word_ids.py <target> {chapter number} {topic number}`

Fix any reported mismatch before moving on.

### Affected files:

- backend/content/<target>/chapter_N/topic_N/sentences.json
- backend/words/catalog.json and backend/words/<target>_words.json, if any word in this
  topic didn't already have a word_id (needed before sentences.json can reference one) —
  check first rather than assuming "Add content in other files" already covered every word.

### Verify

Confirm backend/content/<target>/chapter_N/topic_N/sentences.json actually exists on disk
with exactly 3 sentences per word/expression in <target>/chapter_N/topic_N/words.json, and
that `check_sentence_word_ids.py` above reports no mismatches — don't consider this step
done until that check passes clean.