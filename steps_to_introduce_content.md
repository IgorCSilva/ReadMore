
# Introduce a new pair of idioms



0. Run the prompt to analyze the words in current pt words lists (backend/content/pt/chapter_N/topic_N/words.json) by chapter and topic, and report if some words must be added.
Prompt in: backend/prompts/topic_word_list_audit_prompt.md



# Introduce content

## Add vocabulary

PROMPT: 

idiom: es
chapter: 2
topic: 3

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



## Add relations

native: pt
idiom: es
file: backend/content/es/chapter_2/topic_3/words.json
chapter: 2
topic: 3

Build the reverse-lookup relations for this chapter/topic in
backend/content/relations/<native>-<idiom>-relations.json, matching the existing nested shape:

{
  "chapter_<N>": {
    "topic_<M>": {
      "<native>": {
        "<native_word_or_expression>": "<idiom_equivalent>" | ["<idiom_option_1>", "<idiom_option_2>"]
      }
    }
  }
}

A value is always one or more COMPLETE, whole-expression equivalents of the
native key — never a decomposition into separate idiom words. If the native
key is a multi-word expression (e.g. "bom dia"), the value is the single
composed idiom phrase that expresses it (e.g. "good morning"), not an array
of its parts (never ["good", "morning"]) — even when that composed phrase
isn't itself a stored token in <idiom>'s own chapter_<N>/topic_<M>/words.json, as long as every word inside it
is. An array is only for genuinely distinct alternative equivalents — cases
where the native word/expression could correctly go to more than one whole
idiom form depending on context (e.g. "está" → ["are", "is"]; "noite",
ambiguous between "evening" and "night" in Portuguese, → ["evening",
"night"]; "boa noite" → ["good evening", "good night"]). If you're not sure
whether something is a decomposition or a genuine alternative, it's a
decomposition — compose it into one string instead.

1. Read <native>/chapter_<N>/topic_<M>/words.json (the actual
   current content, not a remembered one) — this is the exact and only
   source of valid keys. Read <file>'s chapter_<N>/topic_<M>/words.json — the
   words available to compose values from.

2. Before writing, check whether the target relations file already exists.
   If it does, read it first. If its content looks wrong for the stated
   pair (wrong script/characters for <idiom>, e.g. Korean under a "-en-"
   filename), flag it explicitly as a bug to fix, not something to build on
   top of.

3. For each word/expression in <native>'s words.json list for this chapter/topic,
   find its complete equivalent(s), composed from words that literally
   appear in <file>'s list for this same chapter/topic — not a free
   translation, and not restricted to a single literal token when the
   natural equivalent is itself a short phrase (e.g. "de nada" → "you are
   welcome", composed from "you"/"are"/"welcome", all separately taught).
   No key outside <native>'s own words.json list for this chapter/topic; every
   word inside a value must come from <file>'s own list for this
   chapter/topic.

4. If a native word/expression has no equivalent that can be composed from
   <file>'s list at all (not even a functional, slightly-loose one), leave
   it out of the JSON and flag it in your report instead — don't force a
   mapping just to avoid an empty result. Merge into the file — preserve
   every other chapter/topic already present untouched.

Output: the new/updated chapter_<N>/topic_<M> block, and a one-line flag for
any native word with no idiom equivalent in this chapter/topic's list (so
it's a recorded, deliberate gap, not silently dropped).

### Affected files:

- backend/content/relations/<native>-<idiom>-relations.json
- <idiom>/chapter_<N>/topic_<M>/words.json, if building the relations exposes a genuine vocabulary gap
  (e.g. a native word with two distinct senses that the idiom list only
  covers one of) — fix the gap there first, then continue.


## Add content in other files

native: pt
target: es
chapter: 2
topic: 3

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


## Add auxiliar sentences

native: pt
target: es
chapter: 2
topic: 3

Build one "mixin" example sentence per word/expression in this chapter/topic, in
backend/content/auxiliar_sentences/<native>-<target>/chapter_<chapter>/topic_<topic>/sentences.json.
Each sentence is written almost entirely in <native>, with exactly one <target>-language
word or expression — the one it's illustrating — inserted verbatim, in its exact
<target>/chapter_<N>/topic_<M>/words.json spelling (no translation, no blank, no
conjugation). Every other word in the
sentence must be <native>; no other <target>-language word or expression may appear, even
by coincidence (a native word that happens to also spell a target word counts).

1. Read <target>/chapter_<N>/topic_<M>/words.json (the actual current content) —
   this is the exact and only source of which words/expressions need a sentence, and the
   order to produce them in.

2. Before writing, check whether
   backend/content/auxiliar_sentences/<native>-<target>/chapter_<chapter>/topic_<topic>/sentences.json
   already exists (create the directory path if it doesn't). If it exists, read it first —
   merge new entries in, never silently overwrite or drop an existing one. If a word
   already has an entry, leave it as-is and note the skip in your report rather than
   replacing it.

3. Match the file's schema:

{
  "<target_word_or_expression>": "<native-dominant sentence containing that exact target word/expression, verbatim, exactly once, and no other target-language word>"
}

   one key per word/expression from step 1's list, in that same order.

4. Keep each sentence short and natural — similar length/register to a normal spoken
   aside (roughly 5-12 words), reading like a bilingual speaker code-switching for a
   single word, not a translation exercise. A multi-word target expression (e.g. "thank
   you", "nice to meet you") goes in as one unbroken unit, never split across the
   sentence. Vary the sentence frame across entries — don't reuse the same native
   sentence shell for every word with just the target word swapped.

5. After drafting each sentence, re-check it against step 1's own list plus common sense:
   confirm no other <target> word list word (this chapter/topic or otherwise) leaked in
   alongside the intended one.

Output: the new/updated sentences.json content for this chapter/topic, and a one-line
note for any word left unresolved (a natural mixin sentence you couldn't construct
without accidentally introducing a second target word) instead of forcing something
awkward.

### Affected files:

- backend/content/auxiliar_sentences/<native>-<target>/chapter_<chapter>/topic_<topic>/sentences.json


## Add mixed sentences

native: pt
target: es
chapter: 2
topic: 3

Create 100 natural sentences, following the exact pattern of chapter 1 topic 1's mixed_sentences.json in backend/content/pt-es/chapter_1/topic_1/mixed_sentences.json ({sentence_number, content} objects, target words marked with **bold**).

Rules:

Each words/expressions must appear (bolded) at least 5 times across the 100 sentences.
Whenever a sentence would otherwise contain a <native> word that has a <target> equivalent in backend/content/relations/<native>-<target>-relations.json — across the whole file, not just this topic — replace it with the bolded <target> word instead. Apply real <target> grammar when adapting, not a literal swap (e.g. la → el before a stressed-a feminine noun like agua; y → e only when the word immediately following starts with an i-/hi- sound, not just anywhere nearby in the sentence).
Never introduce <target> forms that aren't in the taught vocabulary (e.g. no al, las, los if only singular el/la have been taught) — rephrase instead of contracting.
Before finalizing, verify programmatically: exact sentence count, each word's occurrence count, no duplicate sentences, and no unbolded leftover word that had a mapped equivalent.

The sentences must be located in: backend/content/<native>-<target>/chapter_N/topic_N/mixed_sentences.json.
------------------------------------

Then run the backend/scripts/shuffle_sentences.py script to shuffle sentences:
`python3 backend/scripts/shuffle_sentences.py {pair of idioms} {chapter number} {topic number}`


## Add target idiom natural sentences

target: es
chapter: 2
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

===========================================================

## VERSION: pt-es

### 1. PROMPT: 

Based on the file backend/content/pt/chapter_2/topic_2/words.json with Portuguese words, add equivalent Spanish words in the backend/content/es/chapter_2/topic_2/words.json file for chapter 2 topic 2.

Before adding the words, for each one, show the other options and explain why you chose that one and not another. For every word, also check that the Spanish word's grammatical form matches the Portuguese word's form — not just its meaning:

If the Portuguese word is a conjugated verb (e.g. 3rd-person singular present, like assiste), the Spanish equivalent must be conjugated the same way (e.g. ve), never left as the infinitive (ver).
If it's singular/plural, masculine/feminine, or a specific verb tense/mood, match that exactly.
If Spanish's grammar doesn't have a matching distinction the Portuguese word makes (e.g. Portuguese dois/duas vs. Spanish's gender-invariant dos), say so explicitly instead of forcing a fake pair or silently dropping the mismatch.

### 1.1 PROMPT: 

Compare pt's and es's word lists at a given chapter/topic checkpoint to find expression
gaps between the two learning tracks.

Scope: chapter_2/topic_2. Build the cumulative word
list for each language as every word from chapter_1/topic_1 through chapter_2/topic_2
(i.e. every backend/content/<lang>/chapter_N/topic_N/words.json in that range),
in curriculum order across chapters (not just within one chapter) — this is the full
vocabulary a learner has actually seen by that point.

For the target topic's theme (from roadmap.md's topic description):
1. List natural, grammatical sentences/expressions about that theme that can be built
   from pt's cumulative Portuguese word list, respecting that level's grammar
   ceiling (e.g., A0 = simple present, no subordination, per didactic_roadmap.md).
2. For each one, check whether an equivalent expression (same meaning, not same
   words) can be built from es's cumulative Spanish word list at the same
   chapter/topic checkpoint.
3. Report only the ones that fail step 2 — i.e., genuine content-parity gaps where
   Portuguese can say something about the theme that Spanish's curriculum can't yet
   say, not just cases where the two languages phrase it differently.

For each gap, state: the Portuguese expression, the concept it conveys, and the
minimal word/structure missing from es's cumulative list that would close it.
Don't edit es's word lists — this is an audit, following the same flag-don't-fix convention
as didactic_roadmap.md.

### 2. Run the prompt in backend/prompts/phase_words_adaptation.md.

It will do:

- Add words in backend/words/es_words.json;
- Add data in pt-es relations;
- Add words in backend/words/catalog.json;
- Add sentences in backend/words/sentences.json;
- Add cues in backend/words/cues.json;
- Add topic data and words ids in backend/content/pt-es/chapter_2/topic_2/;

### 3. Spanish version -------------------
Create 100 natural sentences for chapter 2, topic 2, following the exact pattern of chapter 1 topic 1's mixed_sentences.json in backend/content/pt-es/chapter_1/topic_1/mixed_sentences.json ({sentence_number, content} objects, target words marked with **bold**).

Rules:

Each of chapter 2 topic 2's own words must appear (bolded) at least 5 times across the 100 sentences.
Whenever a sentence would otherwise contain a Portuguese word that has a Spanish equivalent in backend/content/relations/pt-es-relations.json — across the whole file, not just this topic — replace it with the bolded Spanish word instead. Apply real Spanish grammar when adapting, not a literal swap (e.g. la → el before a stressed-a feminine noun like agua; y → e only when the word immediately following starts with an i-/hi- sound, not just anywhere nearby in the sentence).
Never introduce Spanish forms that aren't in the taught vocabulary (e.g. no al, las, los if only singular el/la have been taught) — rephrase instead of contracting.
Before finalizing, verify programmatically: exact sentence count, each word's occurrence count, no duplicate sentences, and no unbolded leftover word that had a mapped equivalent.
------------------------------------

Then run the backend/scripts/shuffle_sentences.py script to shuffle sentences:
`python3 backend/scripts/shuffle_sentences.py {pair of idioms} {chapter number} {topic number}`



### 4. 

Now, generate simple natural sentences, following the pattern in
backend/content/es/chapter_1/topic_1/sentences.json's shape, writing them to
backend/content/es/chapter_2/topic_2/sentences.json.
For each word in the chapter 2 topic 2, create 3 natural sentences —
pure Spanish, no Portuguese mixing.



## VERSION: pt-ko

Korean is not cognate with Portuguese and has a different sentence structure (SOV vs
Portuguese's SVO), no verb agreement by grammatical person, no grammatical gender,
grammaticalized speech register, and case/linking particles that don't exist in
Portuguese. The pt-es steps above (near-literal word swap, pt-es-relations.json as a
cognate lookup) do not carry over as-is. Use the steps below instead — same overall shape
as the pt-es workflow, with Korean-specific rules folded into each step.

**Register is decided once for the whole course, before step 1 of chapter 1, and never
revisited per-sentence** — Korean verb endings encode formality in a way Portuguese never
does, so there's no per-sentence Portuguese cue to derive it from. **[Register: 해요체
(polite-informal), decided 2026-09-24.]** Every conjugated verb below uses -아요/어요/여요/
(이)에요, and every register-bound particle uses its casual/spoken allomorph to match
(e.g. the addition particle uses 랑/이랑, not the more literary 와/과 —
`korean_particles.select_addition_particle`'s default `register="casual"` already matches
this).

### 1. 

  PROMPT: Based on the file backend/content/pt/chapter_1/topic_1/words.json with Portuguese words, add equivalent
   Korean words in the backend/content/ko/chapter_1/topic_1/words.json file for chapter 1 topic 1.

  Before touching pt's word list, read
  contents/language_reading_journey_phases/roadmap.md and
  contents/language_reading_journey_phases/didactic_roadmap.md for this chapter/topic —
  the same two mandatory files backend/prompts/topic_word_list_audit_prompt.md checks the
  Portuguese list against. roadmap.md's thematic description and didactic_roadmap.md's
  structural/grammar assignment are a second, independent source of what this topic must
  teach, alongside pt's already-defined word list — this matters more for pt-ko than
  it did for pt-es, because Korean's structural requirements (a case/linking particle, a
  register-bound verb ending) often have no standalone Portuguese word to translate from,
  so pt's list alone can under-specify what the Korean topic actually needs:

  - If didactic_roadmap.md assigns this topic a structural item that pt's word list
    doesn't lexicalize — most commonly a particle (은/는, 이/가, 을/를, 와/과·랑/이랑), since
    Portuguese has no word-level equivalent for any of them — add the Korean word for it
    anyway, even with no pt counterpart to translate from, and note in your report
    that it came from the roadmap assignment rather than from a Portuguese word.
  - Before adding a particle this way, check which particle categories earlier
    chapters/topics already introduced — scan backend/words/ko_words.json's
    `particle_type` field across every prior chapter/topic that pair's pt-ko/ content
    already covers (or ask if ko_words.json doesn't exist yet for this run) — so a category is
    introduced once, at the topic didactic_roadmap.md actually assigns it, never
    redundantly re-"introduced" in a later topic just because a sentence there happens to
    use it too.
  - If roadmap.md's thematic description implies a word pt's own list is missing (the
    same kind of gap backend/prompts/topic_word_list_audit_prompt.md flags on the
    Portuguese side), report that gap rather than silently teaching a smaller vocabulary
    than the roadmap intends.

  Before adding the words, for each one, show the other options and explain why you chose
  that one and not another. Korean's grammar diverges from Portuguese far more than
  Spanish's does, so "matching grammatical form" means something different here — for
  every word:

  - If the Portuguese word is a conjugated verb, its Korean equivalent must be the verb
    stem conjugated in 해요체 (-아요/어요/여요), never left as the dictionary/plain form
    (-다 ending). State the tense/aspect you matched it to.
  - Korean has no grammatical gender and no person agreement — don't force a Korean form
    to distinguish masculine/feminine or 1st/2nd/3rd person; say explicitly that the
    distinction doesn't exist in Korean instead of inventing one (mirrors the pt-es rule
    for dois/duas, but Korean drops far more Portuguese distinctions than Spanish does).
  - Korean plural marking (들) is optional and mostly reserved for people/animate nouns,
    unlike Portuguese's mandatory plural agreement — if the Portuguese word is plural,
    say whether the natural Korean form takes 들 or stays a bare, context-plural noun,
    rather than defaulting to always attaching 들.
  - A Portuguese adjective+copula ("é grande") may need to collapse into one Korean
    descriptive-verb word (e.g. 커요) instead of a 1:1 word swap — see rule 3 in step 3
    below for how that's represented in content/pt-ko/chapter_N/topic_N/word_ids.json.
  - If the Korean equivalent is a bare noun/verb stem that will host a batchim-conditioned
    particle in step 3's mixed sentences, record its Korean spelling now in
    backend/content/relations/pt-ko-relations.json (chapter_N.topic_M.pt.<word>), even
    before step 2 formally adapts it — step 3 needs that lookup to pick the correct
    particle allomorph.
  - If the word being taught IS a particle (topic 은/는, subject 이/가, object 을/를, or
    addition 와/과·랑/이랑), say so explicitly and note which category it is — step 2 needs
    that category to set `particle_type` on its backend/words/ko_words.json row, which
    drives the frontend's dedicated particle color (frontend/src/shared/koreanParticles.ts,
    a shade of --accent-ko distinct per category, distinguishable from a plain bolded
    Korean word — see App.vue's :root[data-lang="ko"] block).

### 1.1 PROMPT: 

Compare pt's and ko's word lists at a given chapter/topic checkpoint to find expression
gaps between the two learning tracks.

Scope: chapter_1/topic_1. Build the cumulative word
list for each language as every word from chapter_1/topic_1 through chapter_1/topic_1,
in curriculum order across chapters (not just within one chapter) — this is the full
vocabulary a learner has actually seen by that point.

For the target topic's theme (from roadmap.md's topic description):
1. List natural, grammatical sentences/expressions about that theme that can be built
   from pt's cumulative Portuguese word list, respecting that level's grammar
   ceiling (e.g., A0 = simple present, no subordination, per didactic_roadmap.md).
2. For each one, check whether an equivalent expression (same meaning, not same
   words) can be built from ko's cumulative Korean word list at the same
   chapter/topic checkpoint.
3. Report only the ones that fail step 2 — i.e., genuine content-parity gaps where
   Portuguese can say something about the theme that Korean's curriculum can't yet
   say, not just cases where the two languages phrase it differently.

For each gap, state: the Portuguese expression, the concept it conveys, and the
minimal word/structure missing from ko's cumulative list that would close it.
Don't edit ko's word lists — this is an audit, following the same flag-don't-fix convention
as didactic_roadmap.md.

### 2. 
  
  Run the prompt in backend/prompts/phase_words_adaptation.md. It's already pair-agnostic
   (takes the origin-target pair, chapter, and topic as inputs), so it applies to pt-ko
   unchanged. It will do:

   - Add words in backend/words/ko_words.json — for a particle word (see step 1), set its
     `particle_type` field ("topic" / "subject" / "object" / "addition") so it gets its
     dedicated color in the frontend rather than defaulting to "not_apply" (no color);
   - Add data in pt-ko relations (backend/content/relations/pt-ko-relations.json) — the
     same file step 1 and step 3's particle lookups use, so keep it as one consistent file
     rather than treating word-equivalence and particle-lookup as separate concerns;
   - Add words in backend/words/catalog.json;
   - Add sentences in backend/words/sentences.json;
   - Add cues in backend/words/cues.json;
   - Add topic data and word ids in backend/content/pt-ko/chapter_1/topic_1/;

### 3. 
Create 100 natural sentences for chapter 1, topic 1, following the
exact pattern of chapter 1 topic 1's mixed_sentences.json in
backend/content/pt-es/chapter_1/topic_1/mixed_sentences.json
({sentence_number, content} objects, target words marked with **bold**).

Unlike pt-es's near-literal word swap, these are Portuguese carrier sentences restructured
to Korean's own grammar, not word-for-word substitutions. Rules:

Each of chapter 1 topic 1's own words must appear (bolded) at
least 5 times across the 100 sentences.
A taught verb always moves to the end of the carrier sentence, and any Portuguese words it
displaces (e.g. a copula) are dropped rather than left stranded. Example: teaching "como"
(comer, 1st-person present) in "Eu como maçã e banana" produces "Eu maçã e banana
**먹어요**." — not an in-place swap, since Korean verbs are never mid-sentence. Korean
doesn't conjugate by person, so "matching conjugation" for a verb means matching
tense/aspect and the course's register (해요체), not grammatical person.
A Portuguese adjective+copula ("é grande") collapses into the single taught Korean word
(e.g. 커요) rather than a 1:1 word swap — same precedent as multi-token `word` values
elsewhere (es_words.json's "hasta luego").
Batchim-conditioned particles (은/는, 이/가, 을/를, 와/과, 랑/이랑) are always chosen from
the host word's KOREAN form via backend/app/domain/korean_particles.py
(`select_particle`/`select_addition_particle`), looked up in pt-ko-relations.json — never
guessed from the Portuguese spelling, even when the host word itself isn't taught yet and
stays displayed in Portuguese. E.g. teaching "e" as the addition particle in "Eu como maçã
e banana" uses maçã's Korean form 사과 (vowel-final) to select 랑 in the casual register:
"Eu maçã**랑** banana **먹어요**."
Every particle grammatically required by the sentence's Korean portion is always present —
never dropped for simplicity, even informally-spoken Korean doesn't omit its topic/subject/
object/addition particles the way this might tempt a beginner-facing simplification. If the
particle itself isn't this topic's own taught word, it's still written out in plain Korean
script attached to its host (uncolored, unbolded) rather than left out — only the particle
whose word_id this topic actually teaches gets bolded and picks up its dedicated color
(step 1's `particle_type`).
Never introduce a Korean particle or verb ending that hasn't been taught yet — rephrase
instead of reaching for an untaught form (same discipline as pt-es's "never introduce
untaught contractions" rule, applied to Korean's particles/endings instead of Spanish's
articles).
Before finalizing, verify programmatically: exact sentence count, each word's occurrence
count, no duplicate sentences, and no unbolded leftover word that should have been
replaced.
------------------------------------

Then run the backend/scripts/shuffle_sentences.py script to shuffle sentences (pair-
agnostic, works unchanged):
`python3 backend/scripts/shuffle_sentences.py pt-ko {chapter number} {topic number}`



### 4. 

Now, generate simple natural sentences, following the pattern in
backend/content/ko/chapter_<chapter>/topic_<topic>/sentences.json (create it, following
backend/content/es/chapter_1/topic_1/sentences.json's shape, if this is the first pt-ko
topic run).
For each word in the chapter 1 topic 1, create 3 natural sentences —
pure Korean, no Portuguese mixing, every conjugated verb in 해요체 per the register
decision above.



## VERSION: pt-zh

Mandarin Chinese is not cognate with Portuguese and is an isolating language: no verb
conjugation by person, tense, or number at all (tense/aspect is carried by particles like
了/在/着/过 and time adverbs instead), no grammatical gender, and no plural marking on nouns
(plurality is inferred from numbers/context, with 们 reserved for pronouns and people-nouns,
never attached the way Portuguese's -s is). Word order is SVO like Portuguese for basic
sentences (unlike Korean's SOV), but any number+noun phrase requires a measure word/classifier
(量词) between them that has no Portuguese equivalent (个 general-purpose, 本 for bound objects
like books, 张 for flat objects, 只 for animals, ...) — structurally the same kind of
"no Portuguese word to translate from" problem Korean's particles pose, except a measure word
is chosen by the noun's semantic category, not a phonological rule like batchim. Chinese also
has no spaces between any words at all (stronger than Korean, which separates words but glues
particles onto them), so word-boundary matching for target words needs the whole-string
strategy backend/scripts/check_sentence_markers.py already applies to "zh"
(_NO_SPACE_LANGUAGES, _RELIABLE_LANGUAGES), not Korean's left-anchored one. The pt-es steps
(near-literal word swap, relations.json as a cognate lookup) do not carry over as-is. Use the
steps below instead — same overall shape as the pt-es/pt-ko workflows, with Chinese-specific
rules folded into each step.

**Register is decided once for the whole course, before step 1 of chapter 1, and never
revisited per-sentence** — Portuguese "você" is casual/neutral and doesn't map cleanly to
Mandarin's casual 你 vs. formal 您 split, so there's no per-sentence Portuguese cue to derive
it from. **[Register: casual 你, decided 2026-09-26.]** 您 is never used; every "you" reference
below uses 你 regardless of the addressee.

### 1. 

  PROMPT: Based on the file backend/content/pt/chapter_1/topic_1/words.json with Portuguese words, add equivalent
  Chinese words in the backend/content/zh/chapter_1/topic_1/words.json file for chapter 1 topic 1.

  Use Simplified characters, Mainland Mandarin (zh-CN) — matching the TTS locale already
  configured in frontend/src/shared/api.ts's TTS_LANG_OVERRIDES and languages.ts's
  SPEECH_LOCALES.

  Before touching pt's word list, read
  contents/language_reading_journey_phases/roadmap.md and
  contents/language_reading_journey_phases/didactic_roadmap.md for this chapter/topic — the
  same two mandatory files backend/prompts/topic_word_list_audit_prompt.md checks the
  Portuguese list against. roadmap.md's thematic description and didactic_roadmap.md's
  structural/grammar assignment are a second, independent source of what this topic must
  teach, alongside pt's already-defined word list — this matters more for pt-zh than it
  did for pt-es, because Chinese's structural requirements (a measure word, an aspect
  particle) often have no standalone Portuguese word to translate from, so pt's list
  alone can under-specify what the Chinese topic actually needs:

  - If didactic_roadmap.md assigns this topic a structural item that pt's word list
    doesn't lexicalize — most commonly a measure word (个/本/张/只/...) or an aspect particle
    (了 completed, 在/着 ongoing, 过 experiential), since Portuguese has no word-level
    equivalent for any of them — add the Chinese word for it anyway, even with no pt
    counterpart to translate from, and note in your report that it came from the roadmap
    assignment rather than from a Portuguese word.
  - Before adding a measure word this way, check which nouns earlier chapters/topics already
    paired with a measure word — scan backend/words/zh_words.json's `measure_word_type` field
    across every prior chapter/topic that pair's pt-zh/ content already covers (or ask if
    zh_words.json doesn't exist yet for this run) — so the same measure word is reused
    consistently for a given noun rather than re-decided ad hoc each time it reappears.
  - If roadmap.md's thematic description implies a word pt's own list is missing (the
    same kind of gap backend/prompts/topic_word_list_audit_prompt.md flags on the Portuguese
    side), report that gap rather than silently teaching a smaller vocabulary than the
    roadmap intends.

  Before adding the words, for each one, show the other options and explain why you chose
  that one and not another. Chinese's grammar diverges from Portuguese even more radically
  than Korean's does — it has no inflection at all — so "matching grammatical form" means
  something different here — for every word:

  - If the Portuguese word is a conjugated verb, its Chinese equivalent is the bare verb with
    no ending to conjugate — state which aspect particle (了/在/着/过) or time adverb, if any,
    the target sentence will need alongside it to convey the same tense/aspect the Portuguese
    conjugation carries, rather than silently dropping that information.
  - Chinese has no grammatical gender and no person agreement — don't force a Chinese form to
    distinguish masculine/feminine or 1st/2nd/3rd person; say explicitly that the distinction
    doesn't exist in Chinese instead of inventing one (mirrors the pt-es rule for dois/duas
    and the pt-ko rule for person agreement).
  - Chinese plural marking (们) is reserved for pronouns and people-nouns and is never
    attached to ordinary nouns or after a counted quantity — if the Portuguese word is
    plural, say whether the natural Chinese form takes 们 (pronouns/people only) or stays a
    bare, context-plural noun, rather than defaulting to always attaching it.
  - A Portuguese adjective+copula ("é grande") becomes a bare Chinese stative verb with no
    copula ("大", not "是大") — record this collapse the same way pt-ko's word_ids.json files
    represent Korean's adjective+copula collapse (see rule 3 in step 3 below).
  - If the Chinese equivalent is a noun that will need a measure word in step 3's mixed
    sentences, record its measure word now in
    backend/content/relations/pt-zh-relations.json (chapter_N.topic_M.pt.<word>), even before
    step 2 formally adapts it — step 3 needs that lookup to pick the correct measure word.
  - If the word being taught IS a measure word or aspect particle, say so explicitly and note
    which category it is — step 2 needs that category to set a `measure_word_type` (or
    `not_apply`) field on its backend/words/zh_words.json row, mirroring ko_words.json's
    `particle_type`, which would drive a dedicated frontend color for measure words/particles
    the same way frontend/src/shared/koreanParticles.ts does for Korean — this frontend piece
    doesn't exist yet for Chinese and needs building alongside the first topic that
    introduces a measure word or aspect particle.

### 1.1 PROMPT: 

Compare pt's and zh's word lists at a given chapter/topic checkpoint to find expression
gaps between the two learning tracks.

Scope: chapter_1/topic_1. Build the cumulative word
list for each language as every word from chapter_1/topic_1 through chapter_1/topic_1,
in curriculum order across chapters (not just within one chapter) — this is the full
vocabulary a learner has actually seen by that point.

For the target topic's theme (from roadmap.md's topic description):
1. List natural, grammatical sentences/expressions about that theme that can be built
   from pt's cumulative Portuguese word list, respecting that level's grammar
   ceiling (e.g., A0 = simple present, no subordination, per didactic_roadmap.md).
2. For each one, check whether an equivalent expression (same meaning, not same
   words) can be built from zh's cumulative Chinese word list at the same
   chapter/topic checkpoint.
3. Report only the ones that fail step 2 — i.e., genuine content-parity gaps where
   Portuguese can say something about the theme that Chinese's curriculum can't yet
   say, not just cases where the two languages phrase it differently.

For each gap, state: the Portuguese expression, the concept it conveys, and the
minimal word/structure missing from zh's cumulative list that would close it.
Don't edit zh's word lists — this is an audit, following the same flag-don't-fix convention
as didactic_roadmap.md.

### 2. 
  
  Run the prompt in backend/prompts/phase_words_adaptation.md. It's already pair-agnostic
   (takes the origin-target pair, chapter, and topic as inputs), so it applies to pt-zh
   unchanged. It will do:

   - Add words in backend/words/zh_words.json — for a measure word or aspect particle (see
     step 1), set its `measure_word_type` field so it gets its dedicated color in the
     frontend rather than defaulting to "not_apply" (no color);
   - Add data in pt-zh relations (backend/content/relations/pt-zh-relations.json) — the same
     file step 1 and step 3's measure-word lookups use, so keep it as one consistent file
     rather than treating word-equivalence and measure-word-lookup as separate concerns;
   - Add words in backend/words/catalog.json;
   - Add sentences in backend/words/sentences.json;
   - Add cues in backend/words/cues.json;
   - Add topic data and word ids in backend/content/pt-zh/chapter_1/topic_1/;

### 3. 
Create 100 natural sentences for chapter 1, topic 1, following the
exact pattern of chapter 1 topic 1's mixed_sentences.json in
backend/content/pt-es/chapter_1/topic_1/mixed_sentences.json
({sentence_number, content} objects, target words marked with **bold**).

Unlike pt-es's near-literal word swap, these are Portuguese carrier sentences restructured
to Chinese's own grammar, not word-for-word substitutions. Rules:

Each of chapter 1 topic 1's own words must appear (bolded) at
least 5 times across the 100 sentences.
A taught verb keeps Portuguese's SVO position (unlike pt-ko, Chinese doesn't move it to the
end), but any Portuguese conjugation ending or copula it displaces is dropped rather than left
stranded, and any aspect particle the sentence needs (了/在/着) is added immediately after it.
Example: teaching "como" (comer, 1st-person present) in "Eu como maçã e banana" produces
"Eu **吃** maçã e banana." — the bare verb with no ending, since Chinese doesn't conjugate by
person and a general-present statement needs no aspect particle.
A Portuguese adjective+copula ("é grande") collapses into the single taught Chinese stative
verb (e.g. 大) with no copula, rather than a 1:1 word swap — same precedent as multi-token
`word` values elsewhere (es_words.json's "hasta luego").
A counted noun always takes its measure word between the number and the noun (数+量词+名词),
chosen from the host word's CHINESE form via its recorded measure word in
pt-zh-relations.json — never guessed from the Portuguese spelling or omitted, even when the
host noun itself isn't taught yet and stays displayed in Portuguese. E.g. teaching "dois" in
"Eu tenho dois cachorros" uses cachorro's Chinese form 狗 (an animal, taking 只) to produce:
"Eu tenho **两只**狗."
Every measure word grammatically required by a counted noun in the sentence's Chinese portion
is always present — never dropped for simplicity. If the measure word itself isn't this
topic's own taught word, it's still written out in plain Chinese script attached to its number
(uncolored, unbolded) rather than left out — only the measure word/particle whose word_id
this topic actually teaches gets bolded and picks up its dedicated color (step 1's
`measure_word_type`).
Never introduce a Chinese measure word, aspect particle, or grammar pattern that hasn't been
taught yet — rephrase instead of reaching for an untaught form (same discipline as pt-es's
"never introduce untaught contractions" rule, applied to Chinese's measure words/particles
instead of Spanish's articles).
Before finalizing, verify programmatically: exact sentence count, each word's occurrence
count, no duplicate sentences, and no unbolded leftover word that should have been replaced.
Since Chinese has no spaces between words at all, reuse
backend/scripts/check_sentence_markers.py's "zh" handling rather than a \b-anchored search.
------------------------------------

Then run the backend/scripts/shuffle_sentences.py script to shuffle sentences (pair-
agnostic, works unchanged):
`python3 backend/scripts/shuffle_sentences.py pt-zh {chapter number} {topic number}`



### 4. 

Now, generate simple natural sentences, following the pattern in
backend/content/zh/chapter_<chapter>/topic_<topic>/sentences.json (create it, following
backend/content/es/chapter_1/topic_1/sentences.json's shape, if this is the first pt-zh
topic run).
For each word in the chapter 1 topic 1, create 3 natural sentences —
pure Chinese, no Portuguese mixing, using casual 你 per the register decision above and
only aspect particles/measure words already taught.

