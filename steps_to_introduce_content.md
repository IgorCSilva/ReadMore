
Example for pt-es pair.

0. Run the prompt to analyze the words in current pt words list (pt.json) by chapter and topic, and report if some words must be added.
Prompt in: backend/prompts/topic_word_list_audit_prompt.md

- VERSION: pt-es
1. PROMPT: Based on the file backend/content/pt.json with Portuguese words, add equivalent Spanish words in backend/content/es.json file for chapter 1 topic 4.
For each word show the other options and explain why did you chose that and not another.

2. Run the prompt in backend/prompts/phase_words_adaptation.md.

It will do:

- Add words in backend/words/es_words.json;
- Add data in pt-es relations;
- Add words in backend/words/catalog.json;
- Add sentences in backend/words/sentences.json;
- Add cues in backend/words/cues.json;
- Add topic data and words ids in backend/content/pt-es.json;

3. Spanish version -------------------
Create 100 natural sentences for chapter 1, topic 4, following the exact pattern of chapter 1 topic 1's sentences array in backend/content/pt-es.json ({sentence_number, content} objects, target words marked with **bold**).

Rules:

Each of topic 4's own words must appear (bolded) at least 5 times across the 100 sentences.
Whenever a sentence would otherwise contain a Portuguese word that has a Spanish equivalent in backend/content/relations/pt-es-relations.json — across the whole file, not just this topic — replace it with the bolded Spanish word instead. Apply real Spanish grammar when adapting, not a literal swap (e.g. la → el before a stressed-a feminine noun like agua; y → e only when the word immediately following starts with an i-/hi- sound, not just anywhere nearby in the sentence).
Never introduce Spanish forms that aren't in the taught vocabulary (e.g. no al, las, los if only singular el/la have been taught) — rephrase instead of contracting.
Before finalizing, verify programmatically: exact sentence count, each word's occurrence count, no duplicate sentences, and no unbolded leftover word that had a mapped equivalent.
------------------------------------

Then run the backend/scripts/shuffle_sentences.py script to shuffle sentences:
`python3 backend/scripts/shuffle_sentences.py {pair of idioms} {chapter number} {topic number}`



4. Now, generate simple natural sentences, following the pattern in backend/content/es_sentences.json.
For each word in the chapter 1 topic 3 create 3 natural sentences.
