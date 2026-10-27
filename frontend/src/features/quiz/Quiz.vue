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
        <img id="quiz-gender-icon" class="quiz-gender-icon" alt="" style="display:none">
        <div class="missing" id="quiz-missing">
          <div>
            <div class="missing-cue-label">Cue</div>
            <div class="missing-cue" id="quiz-missing-cue"></div>
          </div>
        </div>
      </div>

      <div class="quiz-options" id="quiz-options"></div>

      <form class="quiz-jump" id="quiz-jump" style="display:none" @submit.prevent>
        <label for="quiz-jump-input">Go to #</label>
        <input type="number" id="quiz-jump-input" min="1">
        <button type="button" id="quiz-jump-btn">Go</button>
      </form>
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
//
// showCatalog() is a second entry point (PictureQuizPage.vue) that skips the
// topic/user-progress plumbing above entirely and quizzes over a language
// pair's whole word catalog instead, in the catalog's own file order (never
// shuffled — see buildCatalogEntries) so a round's position in that order is
// stable and the #quiz-jump control below can jump straight to it.

const EXT_FALLBACKS = ["png", "jpg", "jpeg", "webp", "gif", "jfif"];
let OPTION_COUNT = 4;
// Drives both the #quiz-jump control's visibility and the options grid's
// sizing (see renderStage): the topic quiz's 4 square tiles stay as-is, but
// 6 catalog options as squares would be needlessly tall, so catalog mode
// swaps in .quiz-options-compact (height sized to the word, not a square).
let CATALOG_MODE = false;

function toEntry(w, isReinforcement) {
  const dot = w.filename.lastIndexOf(".");
  const base = dot >= 0 ? w.filename.slice(0, dot) : w.filename;
  const ext = dot >= 0 ? w.filename.slice(dot + 1) : "png";
  // Some gendered variants ("one_feminine") have no picture of their own and
  // are meant to reuse their base word's image ("one") with the gender badge
  // layered on top; others ("they_feminine") do have a dedicated picture.
  // fallbackBase is tried only if the literal filename's image 404s.
  const fallbackBase = base.replace(/_(?:feminine|masculine)$/, "");
  return {
    wordId: w.word_id,
    word: w.original,
    base,
    ext,
    fallbackBase: fallbackBase !== base ? fallbackBase : null,
    cue: w.cue || "",
    isReinforcement,
    genderId: w.gender_id || "not_apply",
  };
}

// Only masculine/feminine words get a corner badge on the picture — "not_apply"
// and "neuter" words (see shared/genders.ts) have no symbol to show.
const GENDER_ICONS = { masculine: "images/masculine.jpg", feminine: "images/feminine.jpg" };

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
let showCatalog;
let pause;

onMounted(() => {
  const errorBanner = document.getElementById("quiz-error-banner");
  const loadingEl = document.getElementById("quiz-loading");
  const emptyStateEl = document.getElementById("quiz-empty-state");
  const stageEl = document.getElementById("quiz-stage");
  const counterEl = document.getElementById("quiz-counter");
  const imgEl = document.getElementById("quiz-img");
  const genderIconEl = document.getElementById("quiz-gender-icon");
  const missingEl = document.getElementById("quiz-missing");
  const missingCueEl = document.getElementById("quiz-missing-cue");
  const optionsEl = document.getElementById("quiz-options");
  const jumpEl = document.getElementById("quiz-jump");
  const jumpInputEl = document.getElementById("quiz-jump-input");
  const jumpBtn = document.getElementById("quiz-jump-btn");

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

  // The literal filename's extensions are exhausted first, so a dedicated
  // gendered image (e.g. "they_feminine.jpg") is preferred when one exists;
  // only then does it fall back to the gender-stripped base (e.g. "one").
  function imageCandidates(entry) {
    const bases = entry.fallbackBase ? [entry.base, entry.fallbackBase] : [entry.base];
    const exts = extCandidates(entry);
    return bases.flatMap((base) => exts.map((ext) => `images/${base}.${ext}`));
  }

  function updateGenderIcon(entry) {
    const src = GENDER_ICONS[entry.genderId];
    if (src) {
      genderIconEl.src = src;
      genderIconEl.style.display = "block";
    } else {
      genderIconEl.style.display = "none";
    }
  }

  function loadImage(entry) {
    const candidates = imageCandidates(entry);
    let i = 0;
    imgEl.style.display = "block";
    missingEl.style.display = "none";
    updateGenderIcon(entry);
    function tryNext() {
      if (i >= candidates.length) {
        imgEl.style.display = "none";
        missingEl.style.display = "flex";
        missingCueEl.textContent = entry.cue;
        return;
      }
      const src = candidates[i];
      i++;
      imgEl.onerror = tryNext;
      imgEl.src = src;
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
      jumpEl.style.display = "none";
      return;
    }
    emptyStateEl.style.display = "none";
    stageEl.style.display = "flex";
    jumpEl.style.display = CATALOG_MODE ? "flex" : "none";
    optionsEl.classList.toggle("quiz-options-compact", CATALOG_MODE);
    loadQuestion();
  }

  // 1-based from the input (matches how the counter displays position),
  // clamped to the current word list — out-of-range input (0, negative,
  // past the end) just snaps to the nearest valid position instead of
  // being rejected.
  function goToPosition(oneBasedPosition) {
    if (!Number.isFinite(oneBasedPosition) || WORDS.length === 0) return;
    index = Math.min(Math.max(1, Math.trunc(oneBasedPosition)), WORDS.length) - 1;
    loadQuestion();
  }

  function handleJumpSubmit() {
    goToPosition(Number(jumpInputEl.value));
  }

  jumpBtn.addEventListener("click", handleJumpSubmit);
  jumpInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleJumpSubmit();
  });

  function transformAndFilter(rawWords) {
    const byId = new Map(rawWords.map((w) => [w.word_id, w]));
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
    OPTION_COUNT = 4;
    CATALOG_MODE = false;
    index = 0;
    return loadAndStart().catch(showError);
  };

  // No shuffle here, unlike transformAndFilter above — PictureQuizPage's
  // "type 150, jump there" control only makes sense if position N always
  // means the same word, i.e. the catalog's own (already deterministic)
  // file order.
  function buildCatalogEntries(rawWords) {
    return rawWords.map((w) => toEntry(w, false));
  }

  // Second entry point (see the top-of-file comment): quizzes over an
  // entire language pair's word catalog — `rawWords` is a plain Word[]
  // (from getWords()), not the topic/user-progress-filtered shape `show()`
  // consumes, so this bypasses loadUserWords/transformAndFilter entirely.
  showCatalog = (rawWords, { optionCount = 6, startPosition = 1 } = {}) => {
    OPTION_COUNT = optionCount;
    CATALOG_MODE = true;
    WORDS = buildCatalogEntries(rawWords);
    index = 0;
    setLoading(false);
    renderStage();
    goToPosition(startPosition);
  };

  // Called by the shell when the user switches to a different tab, so an
  // in-flight advance timer doesn't fire a question change while off-screen.
  pause = () => {
    window.clearTimeout(advanceTimer);
  };
});

defineExpose({
  show: (...args) => show(...args),
  showCatalog: (...args) => showCatalog(...args),
  pause: () => pause(),
});
</script>

<style scoped>
.quiz-gender-icon {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  z-index: 1;
}

.quiz-jump {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--muted);
}
.quiz-jump input {
  width: 72px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 14px;
  text-align: center;
}
.quiz-jump button {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}
.quiz-jump button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>

<!-- Unscoped on purpose: .quiz-option elements are created with
     document.createElement (see renderOptions above), not compiled from
     this file's <template>, so Vue's scoped-CSS attribute never lands on
     them — a <style scoped> block here couldn't reach them at all. Plain
     class-based specificity (two classes beat .quiz-option's one) is what
     overrides the square aspect-ratio from LibraryPage.vue's global
     stylesheet. -->
<style>
.quiz-options-compact {
  grid-auto-rows: auto;
}
.quiz-options-compact .quiz-option {
  aspect-ratio: auto;
  padding: 14px 16px;
}
</style>
