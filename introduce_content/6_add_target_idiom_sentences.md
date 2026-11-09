## Add target idiom natural sentences

Check introduce_content/current_info.md file to know the native idiom, target idiom, chapter and topic numbers.

Now, generate simple natural sentences, following the pattern in
backend/content/es/chapter_<chapter>/topic_<topic>/sentences.json.
For each word/expression, create 3 natural sentences.

- For Korean (target: ko)
Sentences with pure Korean, every conjugated verb in 해요체 per the register
decision.

- For Chinese (target: zh)
Sentences with pure Chinese, using casual 你 per the register decision and
only aspect particles/measure words already taught.

- For French (target: fr)
Sentences with pure French, no Spanish mixing. Use tu (informal) throughout, never vous —
**[Register: tu (informal), decided 2026-10-29]**, locked for the whole course the same way
Korean's 해요체 and Chinese's casual 你 are, since there's no per-sentence Spanish cue to
derive it from. Apply correct elision (l'/d'/qu'/j'/n'/s'/m'/t'/c' before a vowel or mute h)
and standard gender/number agreement on articles and adjectives; only use a contraction
(au/du/aux/des) if it's already-taught vocabulary, per "Add mixed sentences"' rule — rephrase
around it otherwise.

- For Japanese (target: ja)
Sentences with pure Japanese, every verb/copula in です/ます (polite) per the register
decision — **[Register: です/ます (polite), decided 2026-11-01]**, locked for the whole
course the same way Korean's 해요체 and French's tu are, since there's no per-sentence
Portuguese cue to derive it from. Write in hiragana/katakana only, no kanji — **[Kanji
policy: kana-only until furigana rendering exists, decided 2026-11-01]**, since a kanji
with no reading aid is unreadable to a beginner and nothing in the app renders furigana
yet. Particles (は/が/を/に/で/と/も) are invariant — unlike Korean's batchim-conditioned
forms, there's no allomorph to choose, just the one written form for each grammatical
role. A counted noun takes its counter (人/匹/冊/個/...) from the word's recorded value in
pt-ja-relations.json, same mechanism as any measure-word/classifier language.

------------------------------------

Reflexive verbs: since the taught word itself is stored as a bare infinitive without its
own pronoun (per 1_add_vocabulary.md's convention — e.g. "réveiller", not "se réveiller"),
these 3 sentences per word should vary which pronoun accompanies it to reflect real usage
(e.g. one 1st-person "je me réveille", one 3rd-person "elle se réveille", one impersonal
"il est bon de se réveiller") rather than defaulting to "se" in all three. This doesn't
affect `word_ids`: `check_sentence_word_ids.py` below only checks that the bare verb
spelling appears somewhere in the sentence as its own whole word, regardless of which
pronoun precedes it, so any grammatically-correct pronoun choice passes.

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