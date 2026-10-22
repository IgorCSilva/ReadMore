## Add auxiliar sentences

native: pt
target: es
chapter: 5
topic: 5

Build one "mixin" example sentence per word/expression in this chapter/topic, in
backend/content/auxiliar_sentences/<native>-<target>/chapter_<chapter>/topic_<topic>/sentences.json.
Each sentence is written almost entirely in <native>, with exactly one word/expression
from THIS chapter/topic's own list highlighted — the one it's illustrating — in its exact
<target>/chapter_<N>/topic_<M>/words.json spelling (no translation, no blank, no
conjugation). This step runs after "Add mixed sentences" (which must already have produced
this chapter/topic's mixed_sentences.json) and reuses that file as its first source of
sentences instead of writing every one from scratch — the 100 sentences there already
satisfy the relations/grammar checks, so any one of them that happens to isolate a single
word is a ready-made, pre-verified mixin example.

1. Read <target>/chapter_<N>/topic_<M>/words.json (the actual current content) —
   this is the exact and only source of which words/expressions need a sentence, and the
   order to produce them in.

2. Read backend/content/<native>-<target>/chapter_<N>/topic_<M>/mixed_sentences.json —
   the pool built by "Add mixed sentences" for this exact chapter/topic. If it doesn't
   exist yet, stop and run that step first; don't fall back to writing every sentence
   from scratch just because this one is missing.

3. For each word/expression in step 1's list (every one has at least 5 bolded occurrences
   across the 100 mixed sentences, per that step's own quota), scan those occurrences for
   one that qualifies as a mixin sentence for it:
   - No other word from THIS SAME chapter/topic's own list is also bolded anywhere else
     in the sentence — only one word new to this topic may be highlighted per sentence,
     since that's still the one being drilled.
   - A word already taught in an EARLIER chapter/topic, bolded elsewhere in the same
     sentence as background review, does not disqualify it — it's already-known
     vocabulary, not a second new concept competing for attention. (This is the one
     deliberate relaxation from the old "no other target-language word at all" rule —
     mixed_sentences.json is written dense by design, so requiring total isolation would
     almost never find a match.)
   - If this word is only ever bolded as part of a short fixed collocation in
     mixed_sentences.json (e.g. "no entiendo", "no sé", "puede repetir") because that's
     how its grammar is taught, that combined bolded span still counts as this word's
     occurrence — don't require it to appear as a lone single-word bold tag.
   - If more than one sentence qualifies, prefer the shortest one (closest to the
     5-12 word "spoken aside" register below); break any remaining tie by the lowest
     `sentence_number`.

4. When a sentence qualifies, reuse its `content` verbatim (same text, same bolding) as
   this word's entry — don't edit, shorten, re-bold, or re-translate it; it was already
   relations/grammar-checked when "Add mixed sentences" ran. Record which
   `sentence_number` was reused for each word in your report.

5. Only when NO sentence in mixed_sentences.json qualifies for a word (expect this for a
   handful of words, not none — density cuts both ways) fall back to writing one fresh
   sentence for that word alone, under the original stricter rule: almost entirely
   <native> prose, with exactly one <target>-language word or expression — the one being
   illustrated — inserted verbatim, and no other <target>-language word anywhere else in
   that fresh sentence, even by coincidence (a <native> word that happens to also spell a
   target word counts). Keep it short and natural (roughly 5-12 words), reading like a
   bilingual speaker code-switching for a single word, not a translation exercise. A
   multi-word target expression goes in as one unbroken unit. Vary the sentence frame
   across these fallback entries — don't reuse the same native sentence shell for more
   than one of them.

6. Before writing, check whether
   backend/content/auxiliar_sentences/<native>-<target>/chapter_<chapter>/topic_<topic>/sentences.json
   already exists (create the directory path if it doesn't). If it exists, read it first —
   merge new entries in, never silently overwrite or drop an existing one. If a word
   already has an entry, leave it as-is and note the skip in your report rather than
   replacing it.

7. Match the file's schema:

{
  "<target_word_or_expression>": "<reused mixed_sentences.json content, or a fresh fallback sentence>"
}

   one key per word/expression from step 1's list, in that same order.

8. After resolving each word (reused or freshly written), re-check it against step 1's
   own list plus common sense: confirm no other NEW (this-chapter/topic) target word list
   word leaked in alongside the intended one.

Output: the new/updated sentences.json content for this chapter/topic; for each word, a
one-line note of whether it was reused from mixed_sentences.json (with its
`sentence_number`) or freshly written as a fallback; and a one-line note for any word left
unresolved (couldn't find a qualifying reuse candidate AND couldn't construct a fresh
sentence without accidentally introducing a second target word) instead of forcing
something awkward.

### Affected files:

- backend/content/auxiliar_sentences/<native>-<target>/chapter_<chapter>/topic_<topic>/sentences.json

### Verify

Confirm the file above actually exists on disk and has exactly one entry per
word/expression in <target>/chapter_<N>/topic_<M>/words.json, in that same order — not a
subset, and not missing the ones that fell back to a freshly-written sentence.
