<template>
  <div id="topic-exercises-panel" style="display:none">
    <div class="texts-page">
      <div class="error-banner" id="exercises-error-banner"></div>
      <div class="empty-state" id="exercises-empty-state">No exercises available yet.</div>
      <div class="exercise-list" id="exercises-list" style="display:none"></div>
    </div>
  </div>

  <div class="image-lightbox" id="image-lightbox">
    <img id="image-lightbox-img" alt="">
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { getWords } from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { readStale, refreshInBackground } from '../../shared/dataSync'
import { escapeHtml } from '../../shared/text'

// Extracted from App.vue's monolithic script (Step 2.6 of RESTRUCTURE_PLAN.md
// Phase 2), same pattern as Flashcards.vue/Texts.vue: imperative style
// preserved, shell keeps owning tab visibility unchanged, coordination is
// the exposed show(lang, topic) method called from switchTopicTab()'s
// single call site. The image lightbox moves here too since it's only ever
// opened from this panel's exercise cue images (buildCueEl) — nothing else
// in the app uses it.

const EXT_FALLBACKS = ["png", "jpg", "jpeg", "webp", "gif", "jfif"];

let LANG = "pt-en";
let CUE_LANG = "origin";
let currentTopic = null;

let show;

onMounted(() => {
  let WORDS_BY_ID = null;
  let wordsLoadedForLang = null;
  let wordsLoadedForCueLang = null;

  const exercisesErrorBanner = document.getElementById("exercises-error-banner");
  const exercisesEmptyStateEl = document.getElementById("exercises-empty-state");
  const exercisesListEl = document.getElementById("exercises-list");

  function showExercisesError(err) {
    console.error(err);
    exercisesErrorBanner.style.display = "block";
    exercisesErrorBanner.innerHTML = `Couldn't load exercises (${err.message}).`;
  }

  function indexById(words) {
    const byId = {};
    for (const w of words) byId[w.word_id] = w;
    return byId;
  }

  async function fetchWords(lang, cueLang) {
    const data = await getWords(lang, undefined, cueLang);
    return data.words;
  }

  async function loadWordsById(lang, cueLang) {
    if (WORDS_BY_ID && wordsLoadedForLang === lang && wordsLoadedForCueLang === cueLang) {
      return WORDS_BY_ID;
    }

    const key = cacheKey("words", lang, cueLang);
    const cached = readStale(key);
    if (cached) {
      WORDS_BY_ID = indexById(cached.data);
      wordsLoadedForLang = lang;
      wordsLoadedForCueLang = cueLang;
      refreshInBackground({
        key,
        label: "word list",
        fetchFn: () => fetchWords(lang, cueLang),
        onFresh: (words) => {
          WORDS_BY_ID = indexById(words);
          wordsLoadedForLang = lang;
          wordsLoadedForCueLang = cueLang;
          // Only re-render if the user hasn't switched languages/cue choice
          // since this refresh started.
          if (LANG === lang && CUE_LANG === cueLang) renderExercises().catch(showExercisesError);
        },
      });
      return WORDS_BY_ID;
    }

    const words = await fetchWords(lang, cueLang);
    writeCache(key, words);
    WORDS_BY_ID = indexById(words);
    wordsLoadedForLang = lang;
    wordsLoadedForCueLang = cueLang;
    return WORDS_BY_ID;
  }

  function extCandidatesForFilename(filename) {
    const dot = filename.lastIndexOf(".");
    const base = dot >= 0 ? filename.slice(0, dot) : filename;
    const ext = dot >= 0 ? filename.slice(dot + 1) : null;
    const list = ext ? [ext, ...EXT_FALLBACKS] : [...EXT_FALLBACKS];
    return { base, list: [...new Set(list)] };
  }

  const imageLightboxEl = document.getElementById("image-lightbox");
  const imageLightboxImg = document.getElementById("image-lightbox-img");

  function openImageLightbox(src, alt) {
    imageLightboxImg.src = src;
    imageLightboxImg.alt = alt || "";
    imageLightboxEl.classList.add("visible");
  }
  function closeImageLightbox() {
    imageLightboxEl.classList.remove("visible");
  }
  imageLightboxEl.addEventListener("click", closeImageLightbox);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeImageLightbox();
  });

  function buildCueEl(word) {
    const wrap = document.createElement("span");
    wrap.className = "exercise-cue-wrap";
    if (!word || !word.filename) return wrap;

    const { base, list } = extCandidatesForFilename(word.filename);
    const img = document.createElement("img");
    img.className = "exercise-cue-image";
    img.alt = word.original;
    img.addEventListener("click", () => openImageLightbox(img.src, word.original));
    wrap.appendChild(img);

    let i = 0;
    function tryNext() {
      if (i >= list.length) {
        img.remove();
        showCueButton();
        return;
      }
      const ext = list[i];
      i++;
      img.onerror = tryNext;
      img.src = `images/${base}.${ext}`;
    }
    function showCueButton() {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cue-btn";
      btn.textContent = "cue";

      const balloon = document.createElement("div");
      balloon.className = "cue-balloon";
      balloon.textContent = word.cue || "";

      btn.addEventListener("click", () => balloon.classList.toggle("visible"));

      wrap.appendChild(btn);
      wrap.appendChild(balloon);
    }
    tryNext();

    return wrap;
  }

  function boldInline(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function makeExerciseInput(extraClass) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = extraClass ? `exercise-input ${extraClass}` : "exercise-input";
    input.autocomplete = "off";
    input.spellcheck = false;
    return input;
  }

  // sentence has one "_____" per blank; word_ids has one entry per blank, in
  // order, so splitting the sentence on the marker always yields
  // word_ids.length + 1 pieces to interleave input+cue pairs into.
  function buildBlankRow(sentence, wordIds, index) {
    const parts = sentence.split("_____");

    const row = document.createElement("div");
    row.className = "exercise-item";

    const number = document.createElement("span");
    number.className = "exercise-number";
    number.textContent = `${index + 1}.`;
    row.appendChild(number);

    if (parts[0]) row.appendChild(document.createTextNode(parts[0]));

    wordIds.forEach((wordId, i) => {
      const word = WORDS_BY_ID ? WORDS_BY_ID[wordId] : null;
      row.appendChild(makeExerciseInput());
      row.appendChild(buildCueEl(word));
      const nextPart = parts[i + 1];
      if (nextPart) row.appendChild(document.createTextNode(nextPart));
    });

    return row;
  }

  function renderExerciseItem(item, index) {
    return buildBlankRow(item.sentence, item.word_ids, index);
  }

  // sentence_completion: same blank-fill row as fill_in_the_blank, with a
  // leading "situation" line giving the prompt's context.
  function renderSentenceCompletionItem(item, index) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-item-group";

    const situation = document.createElement("div");
    situation.className = "exercise-situation";
    situation.textContent = item.situation;
    wrap.appendChild(situation);

    wrap.appendChild(buildBlankRow(item.sentence, item.word_ids, index));
    return wrap;
  }

  function renderClassifyExercise(exercise) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-classify";

    const bankTitle = document.createElement("div");
    bankTitle.className = "exercise-subtitle";
    bankTitle.textContent = "Palavras para classificar";
    wrap.appendChild(bankTitle);

    const bank = document.createElement("div");
    bank.className = "exercise-word-bank";
    for (const wordId of exercise.word_bank) {
      const word = WORDS_BY_ID ? WORDS_BY_ID[wordId] : null;
      bank.appendChild(buildCueEl(word));
    }
    wrap.appendChild(bank);

    for (const category of exercise.categories) {
      const row = document.createElement("div");
      row.className = "exercise-item";

      const label = document.createElement("span");
      label.className = "exercise-category-title";
      label.textContent = category.title;
      row.appendChild(label);

      const input = makeExerciseInput("exercise-category-input");
      input.placeholder = "Digite as palavras...";
      row.appendChild(input);

      wrap.appendChild(row);
    }

    return wrap;
  }

  // Shared by open_response (flat top-level lines) and guided_open_response
  // (one lines[] per item) — a line either has already-written `text` (bold
  // spans rendered) or a blank `hint` turn for the reader to self-check.
  function renderOpenResponseLines(lines) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-open-response";

    for (const line of lines) {
      const row = document.createElement("div");
      row.className = "exercise-item";

      const speaker = document.createElement("span");
      speaker.className = "exercise-number";
      speaker.textContent = `${line.speaker}:`;
      row.appendChild(speaker);

      if (line.text !== undefined) {
        const span = document.createElement("span");
        span.innerHTML = boldInline(line.text);
        row.appendChild(span);
      } else {
        const input = makeExerciseInput("exercise-open-input");
        input.placeholder = line.hint || "";
        row.appendChild(input);
      }

      wrap.appendChild(row);
    }

    return wrap;
  }

  function renderOpenResponseExercise(exercise) {
    return renderOpenResponseLines(exercise.lines);
  }

  // guided_open_response: several independent mini-exchanges, each its own
  // lines[] (unlike open_response's single flat conversation) — render each
  // as its own numbered group.
  function renderGuidedOpenResponseExercise(exercise) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-guided-list";

    exercise.items.forEach((item, i) => {
      const group = document.createElement("div");
      group.className = "exercise-item-group";

      const number = document.createElement("div");
      number.className = "exercise-number";
      number.textContent = `${i + 1}.`;
      group.appendChild(number);

      group.appendChild(renderOpenResponseLines(item.lines));
      wrap.appendChild(group);
    });

    return wrap;
  }

  // comprehension_question_answering ({statement, question}) and
  // guided_production ({model, prompt}) share the same interaction: read a
  // bolded context sentence, then answer/produce freely with no word cue.
  function renderOpenEndedExercise(exercise) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-open-ended";

    exercise.items.forEach((item, i) => {
      const context = item.statement !== undefined ? item.statement : item.model;
      const prompt = item.question !== undefined ? item.question : item.prompt;

      const group = document.createElement("div");
      group.className = "exercise-item-group";

      const contextEl = document.createElement("div");
      contextEl.className = "exercise-context";
      contextEl.innerHTML = boldInline(context);
      group.appendChild(contextEl);

      const row = document.createElement("div");
      row.className = "exercise-item";

      const number = document.createElement("span");
      number.className = "exercise-number";
      number.textContent = `${i + 1}.`;
      row.appendChild(number);

      const promptEl = document.createElement("span");
      promptEl.className = "exercise-prompt";
      promptEl.textContent = prompt;
      row.appendChild(promptEl);

      row.appendChild(makeExerciseInput("exercise-open-ended-input"));
      group.appendChild(row);

      wrap.appendChild(group);
    });

    return wrap;
  }

  // short_contextual_dialogue: a fully-written dialogue (no blanks) followed
  // by one trailing reading-comprehension question, answered freely.
  function renderDialogueComprehensionExercise(exercise) {
    const wrap = document.createElement("div");
    wrap.className = "exercise-dialogue-comprehension";

    wrap.appendChild(renderOpenResponseLines(exercise.lines));

    const row = document.createElement("div");
    row.className = "exercise-item exercise-question-row";

    const promptEl = document.createElement("span");
    promptEl.className = "exercise-prompt";
    promptEl.textContent = exercise.question;
    row.appendChild(promptEl);

    row.appendChild(makeExerciseInput("exercise-open-ended-input"));
    wrap.appendChild(row);

    return wrap;
  }

  async function renderExercises() {
    exercisesErrorBanner.style.display = "none";
    const exercises = (currentTopic && currentTopic.exercises) || [];

    if (exercises.length === 0) {
      exercisesListEl.style.display = "none";
      exercisesEmptyStateEl.style.display = "block";
      return;
    }

    await loadWordsById(LANG, CUE_LANG);

    exercisesEmptyStateEl.style.display = "none";
    exercisesListEl.style.display = "flex";
    exercisesListEl.innerHTML = "";

    for (const exercise of exercises) {
      const title = document.createElement("h3");
      title.className = "exercise-title";
      title.textContent = exercise.title;
      exercisesListEl.appendChild(title);

      const type = exercise.type;
      if (type === "classify" || type === "vocabulary_classification") {
        exercisesListEl.appendChild(renderClassifyExercise(exercise));
      } else if (type === "open_response") {
        exercisesListEl.appendChild(renderOpenResponseExercise(exercise));
      } else if (type === "guided_open_response") {
        exercisesListEl.appendChild(renderGuidedOpenResponseExercise(exercise));
      } else if (type === "sentence_completion") {
        exercise.items.forEach((item, i) => {
          exercisesListEl.appendChild(renderSentenceCompletionItem(item, i));
        });
      } else if (type === "comprehension_question_answering" || type === "guided_production") {
        exercisesListEl.appendChild(renderOpenEndedExercise(exercise));
      } else if (type === "short_contextual_dialogue") {
        exercisesListEl.appendChild(renderDialogueComprehensionExercise(exercise));
      } else {
        // undefined (legacy) or "fill_in_the_blank": plain items array.
        exercise.items.forEach((item, i) => {
          exercisesListEl.appendChild(renderExerciseItem(item, i));
        });
      }
    }
  }

  show = (lang, topic, cueLang) => {
    LANG = lang;
    CUE_LANG = cueLang || "origin";
    currentTopic = topic;
    return renderExercises().catch(showExercisesError);
  };
});

defineExpose({
  show: (...args) => show(...args),
});
</script>
