<template>
  <div id="topic-quiz-panel" style="display:none">
    <div class="error-banner" id="quiz-error-banner"></div>

    <div class="loading" id="quiz-loading">
      <div class="spinner"></div>
      <div>Loading your words…</div>
    </div>

    <div class="empty-state" id="quiz-empty-state">Not enough learning words for this topic yet.</div>

    <div class="quiz-stage" id="quiz-stage">
      <div class="quiz-counter" id="quiz-counter"></div>

      <div class="image-wrap quiz-image-wrap">
        <img id="quiz-img" alt="">
        <div class="missing" id="quiz-missing">
          <div>
            <div class="missing-cue-label">Cue</div>
            <div class="missing-cue" id="quiz-missing-cue"></div>
          </div>
        </div>
      </div>

      <div class="quiz-options" id="quiz-options"></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { loadUserWords } from '../../shared/userWords'

// New tab: shows a word's picture (or its cue, if no image file exists) and
// four word options in a 2x2 grid — pick the one the picture depicts. Same
// "learning words for this topic" population as Reading/Typing/Dictation
// (show !== false && !confident); like those drills, it never writes
// progress. A correct pick colors that square with the per-target-language
// accent (var(--accent) trio, same as everywhere else in the app); a wrong
// pick colors the click red and reveals the actual answer in --confident
// green. Either way the round locks and auto-advances 1s later.

const EXT_FALLBACKS = ["png", "jpg", "jpeg", "webp", "gif", "jfif"];
const OPTION_COUNT = 4;

function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function uniqueWordCount(entries) {
  return new Set(entries.map((e) => e.word)).size;
}

let USER_EMAIL = null;
let LANG = "pt-en";
let SENTENCE_LANG = "target";
let CUE_LANG = "origin";
let currentTopic = null;
let REINFORCEMENT_WORD_IDS = [];
let WORDS = [];
let index = 0;

let show;
let pause;

onMounted(() => {
  const errorBanner = document.getElementById("quiz-error-banner");
  const loadingEl = document.getElementById("quiz-loading");
  const emptyStateEl = document.getElementById("quiz-empty-state");
  const stageEl = document.getElementById("quiz-stage");
  const counterEl = document.getElementById("quiz-counter");
  const imgEl = document.getElementById("quiz-img");
  const missingEl = document.getElementById("quiz-missing");
  const missingCueEl = document.getElementById("quiz-missing-cue");
  const optionsEl = document.getElementById("quiz-options");

  let advanceTimer = null;
  let answered = false;
  // {btn, option} pairs for the round currently on screen — kept alongside
  // the DOM so a wrong pick can find and highlight the correct button by
  // wordId rather than re-deriving it from text content.
  let currentOptionEls = [];

  function showError(err) {
    console.error(err);
    errorBanner.style.display = "block";
    errorBanner.innerHTML = `Couldn't load your word list (${err.message}).`;
  }

  function setLoading(isLoading) {
    loadingEl.style.display = isLoading ? "flex" : "none";
    if (isLoading) {
      errorBanner.style.display = "none";
      stageEl.style.display = "none";
      emptyStateEl.style.display = "none";
    }
  }

  function extCandidates(entry) {
    return [...new Set([entry.ext, ...EXT_FALLBACKS])];
  }

  function loadImage(entry) {
    const candidates = extCandidates(entry);
    let i = 0;
    imgEl.style.display = "block";
    missingEl.style.display = "none";
    function tryNext() {
      if (i >= candidates.length) {
        imgEl.style.display = "none";
        missingEl.style.display = "flex";
        missingCueEl.textContent = entry.cue;
        return;
      }
      const ext = candidates[i];
      i++;
      imgEl.onerror = tryNext;
      imgEl.src = `images/${entry.base}.${ext}`;
    }
    tryNext();
  }

  function currentEntry() {
    return WORDS[index];
  }

  function buildOptions(entry) {
    const seen = new Set([entry.word]);
    const distractors = [];
    for (const w of shuffle(WORDS.filter((e) => e.wordId !== entry.wordId))) {
      if (distractors.length >= OPTION_COUNT - 1) break;
      if (seen.has(w.word)) continue;
      seen.add(w.word);
      distractors.push(w);
    }
    return shuffle([entry, ...distractors]);
  }

  function renderOptions(entry) {
    optionsEl.innerHTML = "";
    currentOptionEls = buildOptions(entry).map((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.textContent = option.word;
      if (option.isReinforcement) {
        const badge = document.createElement("span");
        badge.className = "reinforcement-badge";
        badge.textContent = "\u{1F4AA}";
        badge.title = "Reinforcement word";
        btn.appendChild(badge);
      }
      btn.addEventListener("click", () => handlePick(btn, option, entry));
      optionsEl.appendChild(btn);
      return { btn, option };
    });
  }

  function handlePick(btn, option, entry) {
    if (answered) return;
    answered = true;

    for (const { btn: otherBtn } of currentOptionEls) otherBtn.disabled = true;

    if (option.wordId === entry.wordId) {
      btn.classList.add("quiz-option-correct");
    } else {
      btn.classList.add("quiz-option-wrong");
      const correct = currentOptionEls.find((o) => o.option.wordId === entry.wordId);
      correct?.btn.classList.add("quiz-option-reveal");
    }

    advanceTimer = window.setTimeout(advance, 1000);
  }

  function loadQuestion() {
    window.clearTimeout(advanceTimer);
    answered = false;
    counterEl.textContent = `${index + 1} / ${WORDS.length}`;
    const entry = currentEntry();
    loadImage(entry);
    renderOptions(entry);
  }

  function advance() {
    index = (index + 1) % WORDS.length;
    loadQuestion();
  }

  function renderStage() {
    window.clearTimeout(advanceTimer);
    if (uniqueWordCount(WORDS) < 2) {
      stageEl.style.display = "none";
      emptyStateEl.style.display = "block";
      return;
    }
    emptyStateEl.style.display = "none";
    stageEl.style.display = "flex";
    loadQuestion();
  }

  function transformAndFilter(rawWords) {
    const byId = new Map(rawWords.map((w) => [w.word_id, w]));
    const toEntry = (w, isReinforcement) => {
      const dot = w.filename.lastIndexOf(".");
      const base = dot >= 0 ? w.filename.slice(0, dot) : w.filename;
      const ext = dot >= 0 ? w.filename.slice(dot + 1) : "png";
      return { wordId: w.word_id, word: w.original, base, ext, cue: w.cue || "", isReinforcement };
    };
    const topicEntries = (currentTopic?.word_ids || [])
      .map((id) => byId.get(id))
      .filter((w) => w && w.show !== false && !w.confident)
      .map((w) => toEntry(w, false));
    // Reinforcement words bypass the !confident and show!==false filters —
    // see Reading.vue's transformAndFilter for the same reasoning.
    const reinforcementEntries = (REINFORCEMENT_WORD_IDS || [])
      .map((id) => byId.get(id))
      .filter((w) => w)
      .map((w) => toEntry(w, true));
    return shuffle([...topicEntries, ...reinforcementEntries]);
  }

  function applyWords(rawWords) {
    WORDS = transformAndFilter(rawWords);
    if (index >= WORDS.length) index = 0;
  }

  async function loadAndStart() {
    setLoading(true);
    try {
      const rawWords = await loadUserWords(USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG);
      applyWords(rawWords);
      renderStage();
    } finally {
      setLoading(false);
    }
  }

  show = (userEmail, lang, topic, sentenceLang, cueLang, reinforcementWordIds) => {
    USER_EMAIL = userEmail;
    LANG = lang;
    SENTENCE_LANG = sentenceLang || "target";
    CUE_LANG = cueLang || "origin";
    currentTopic = topic;
    REINFORCEMENT_WORD_IDS = reinforcementWordIds || [];
    index = 0;
    return loadAndStart().catch(showError);
  };

  // Called by the shell when the user switches to a different tab, so an
  // in-flight advance timer doesn't fire a question change while off-screen.
  pause = () => {
    window.clearTimeout(advanceTimer);
  };
});

defineExpose({
  show: (...args) => show(...args),
  pause: () => pause(),
});
</script>
