<template>
  <div id="topic-flashcards-panel">
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-title">Filter</div>
        <label class="checkbox-row">
          <input type="checkbox" id="filter-confident" checked>
          <span>Confident words</span>
        </label>
        <label class="checkbox-row">
          <input type="checkbox" id="filter-learning" checked>
          <span>Learning words</span>
        </label>

        <div class="sidebar-title">Hidden words</div>
        <div class="hidden-words-hint">Click a word to show it again</div>
        <div class="hidden-words-list" id="hidden-words-list"></div>
      </aside>

      <main class="main">
        <div class="topbar">
          <span id="counter">1 / 1</span>
          <span class="badge confident" id="badge">confident</span>
        </div>

        <div class="error-banner" id="error-banner"></div>

        <div class="loading" id="loading">
          <div class="spinner"></div>
          <div>Loading your words…</div>
        </div>

        <div class="progress"><div class="progress-fill" id="progress-fill"></div></div>

        <div class="card" id="card">
          <div class="sentence-area">
            <div class="label-row">
              <div class="sentence-label">Sentence</div>
              <button type="button" class="speak-btn" id="speak-sentence-btn" title="Play sentence" aria-label="Play sentence">🔊</button>
            </div>
            <div class="sentence" id="sentence"></div>
          </div>
          <div class="image-wrap">
            <img id="img" alt="">
            <div class="missing" id="missing">
              <div>
                <div class="missing-cue-label">Cue</div>
                <div class="missing-cue" id="missing-cue"></div>
              </div>
              <div>
                <div class="label-row">
                  <div class="missing-sentence-label">Sentence</div>
                  <button type="button" class="speak-btn" id="speak-missing-sentence-btn" title="Play sentence" aria-label="Play sentence">🔊</button>
                </div>
                <div class="missing-sentence" id="missing-sentence"></div>
              </div>
            </div>
          </div>
          <div class="cue-area">
            <div class="cue-label">Cue</div>
            <div class="cue" id="cue"></div>
          </div>
          <div class="word-area">
            <div class="label-row">
              <div class="response-label">Response</div>
              <button type="button" class="speak-btn" id="speak-btn" title="Play pronunciation" aria-label="Play pronunciation">🔊</button>
            </div>
            <div class="word hidden-word" id="word">•••••</div>
            <div class="hint">click word to reveal</div>
          </div>
        </div>

        <div class="empty-state" id="empty-state">No words match the selected filters.</div>

        <div class="controls">
          <span><kbd>←</kbd> <kbd>→</kbd> browse</span>
          <span><kbd>space</kbd> mark shown + next</span>
          <span><kbd>enter</kbd> I know this + next</span>
        </div>

        <div class="action-bar" id="action-bar">
          <button type="button" class="action-btn action-btn-icon" id="prev-btn" title="Previous word" aria-label="Previous word">←</button>
          <button type="button" class="action-btn" id="know-btn">I know</button>
          <button type="button" class="action-btn action-btn-primary" id="next-word-btn">Next</button>
          <button type="button" class="action-btn action-btn-icon" id="next-btn" title="Next word" aria-label="Next word">→</button>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { getUserWords, ttsUrl } from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { readStale, refreshInBackground } from '../../shared/dataSync'
import { formatWordByGender, getGender } from '../../shared/genders'
import { speechLocaleFor } from '../../shared/languages'
import { hasQueuedAction, performWrite } from '../../shared/writeQueue'

// Extracted from App.vue's monolithic script (Step 2.4 of RESTRUCTURE_PLAN.md
// Phase 2) — same imperative/document.getElementById style as the rest of
// Phase 2 so far, not a reactive rewrite. The shell (App.vue) still owns tab
// visibility (toggling #topic-flashcards-panel's display via
// getElementById, which still works from outside this component since Vue
// doesn't isolate a child's rendered DOM from the rest of the page) and
// topic/user/lang selection; it calls this component's exposed load()
// whenever the Flashcards tab becomes active — the same single call site
// the original script had inside switchTopicTab().
//
// CSS for these elements stays in App.vue's global <style> block for now:
// sorting hundreds of rules into per-component scopes is a separate, larger
// effort than "extract this tab's markup/logic" and risks subtle visual
// regressions if done hastily — not attempted in this step.

const EXT_FALLBACKS = ["png", "jpg", "jpeg", "webp", "gif", "jfif"];

let USER_EMAIL = null;
let LANG = "pt-en";
let SENTENCE_LANG = "target";
let CUE_LANG = "origin";
let currentTopic = null;
let ALL_ENTRIES = [];
let ENTRIES = [];
let HIDDEN_ENTRIES = [];
let index = 0;
let revealed = false;

// Assigned inside onMounted, once DOM refs exist; the wrapper below is what
// defineExpose captures, and it's only ever called by the parent after this
// component (and therefore onMounted) has already run.
let load;

onMounted(() => {
  const img = document.getElementById("img");
  const missing = document.getElementById("missing");
  const missingCueEl = document.getElementById("missing-cue");
  const missingSentenceEl = document.getElementById("missing-sentence");
  const wordEl = document.getElementById("word");
  const cueEl = document.getElementById("cue");
  const sentenceEl = document.getElementById("sentence");
  const sentenceAreaEl = document.querySelector(".sentence-area");
  const cueAreaEl = document.querySelector(".cue-area");
  const counterEl = document.getElementById("counter");
  const badgeEl = document.getElementById("badge");
  const progressFill = document.getElementById("progress-fill");
  const errorBanner = document.getElementById("error-banner");
  const loadingEl = document.getElementById("loading");
  const cardEl = document.getElementById("card");
  const controlsEl = document.querySelector(".controls");
  const actionBarEl = document.getElementById("action-bar");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const knowBtn = document.getElementById("know-btn");
  const nextWordBtn = document.getElementById("next-word-btn");
  const progressEl = document.querySelector(".progress");
  const emptyStateEl = document.getElementById("empty-state");
  const filterConfidentEl = document.getElementById("filter-confident");
  const filterLearningEl = document.getElementById("filter-learning");
  const hiddenListEl = document.getElementById("hidden-words-list");
  const speakBtn = document.getElementById("speak-btn");
  const speakSentenceBtn = document.getElementById("speak-sentence-btn");
  const speakMissingSentenceBtn = document.getElementById("speak-missing-sentence-btn");

  const SPEECH_SUPPORTED = "speechSynthesis" in window;

  // LANG is "origin-target" (e.g. "pt-es"); the word itself is always the
  // target-language spelling, while the sentence follows whichever side
  // SENTENCE_LANG currently points at.
  function targetLangCode() {
    const [, target] = LANG.split("-");
    return target || LANG;
  }

  function originLangCode() {
    const [origin] = LANG.split("-");
    return origin || LANG;
  }

  function speakWordLocal(text, langCode) {
    if (!SPEECH_SUPPORTED || !text) return;
    window.speechSynthesis.cancel(); // stop anything already speaking
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocaleFor(langCode);
    window.speechSynthesis.speak(utterance);
  }

  function speakWord(text, langCode) {
    if (!text) return;
    const audio = new Audio(ttsUrl(text, langCode));
    audio.addEventListener("error", () => {
      console.warn("TTS proxy unavailable (is the backend running?), falling back to local speech synthesis.");
      speakWordLocal(text, langCode);
    });
    audio.play().catch(() => {
      console.warn("TTS playback blocked/failed, falling back to local speech synthesis.");
      speakWordLocal(text, langCode);
    });
  }

  speakBtn.addEventListener("click", () => {
    if (ENTRIES.length === 0) return;
    speakWord(ENTRIES[index].word, targetLangCode());
  });

  function speakCurrentSentence() {
    if (ENTRIES.length === 0) return;
    const entry = ENTRIES[index];
    const filledSentence = entry.sentence.replace(/_+/g, entry.word);
    speakWord(filledSentence, SENTENCE_LANG === "origin" ? originLangCode() : targetLangCode());
  }

  speakSentenceBtn.addEventListener("click", speakCurrentSentence);
  speakMissingSentenceBtn.addEventListener("click", speakCurrentSentence);

  function transformWords(words) {
    const entries = words.map((e) => {
      const dot = e.filename.lastIndexOf(".");
      const base = dot >= 0 ? e.filename.slice(0, dot) : e.filename;
      const ext = dot >= 0 ? e.filename.slice(dot + 1) : "png";
      return {
        wordId: e.word_id,
        word: e.original,
        genderId: e.gender_id || "not_apply",
        base,
        ext,
        confident: e.confident,
        cue: e.cue || "",
        sentence: e.sentence || "",
        shownCount: e.shown_count || 0,
        show: e.show !== false,
      };
    });

    entries.sort((a, b) => a.shownCount - b.shownCount);

    // A queued mark-known/show-word write hasn't reached the server yet, so
    // freshly-fetched data (cached or just-refreshed) can still show the old
    // "show" value — override it with the user's own not-yet-synced intent
    // so a background refresh can't silently undo their last action.
    for (const entry of entries) {
      if (hasQueuedAction(USER_EMAIL, LANG, entry.wordId, "mark-known")) entry.show = false;
      else if (hasQueuedAction(USER_EMAIL, LANG, entry.wordId, "show-word")) entry.show = true;
    }

    return entries;
  }

  // Caches the raw API words, not the transformed entries — the queued-write
  // override in transformWords() needs to be re-applied fresh every time
  // it's read, since the write queue can change between when this was
  // cached and when it's read back.
  async function fetchRawWords() {
    const data = await getUserWords(USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG);
    return data.words;
  }

  function showError(err) {
    console.error(err);
    errorBanner.style.display = "block";
    errorBanner.innerHTML =
      `Couldn't load your word list (${err.message}).<br>` +
      `Make sure the backend is running and you're accessing this app at its own ` +
      `address, not a <code>file://</code> path.`;
  }

  function setLoading(isLoading) {
    loadingEl.style.display = isLoading ? "flex" : "none";
    if (isLoading) {
      errorBanner.style.display = "none";
      cardEl.style.display = "none";
      progressEl.style.display = "none";
      controlsEl.style.display = "none";
      actionBarEl.style.display = "none";
      emptyStateEl.style.display = "none";
      badgeEl.style.display = "none";
    }
  }

  function extCandidates(entry) {
    const list = [entry.ext, ...EXT_FALLBACKS];
    return [...new Set(list)];
  }

  function loadImage(entry) {
    const candidates = extCandidates(entry);
    let i = 0;

    img.style.display = "block";
    missing.style.display = "none";
    sentenceAreaEl.style.display = "block";
    cueAreaEl.style.display = "block";

    function tryNext() {
      if (i >= candidates.length) {
        img.style.display = "none";
        missing.style.display = "flex";
        sentenceAreaEl.style.display = "none";
        cueAreaEl.style.display = "none";
        missingCueEl.textContent = entry.cue;
        missingSentenceEl.textContent = entry.sentence;
        return;
      }
      const ext = candidates[i];
      i++;
      img.onerror = tryNext;
      img.src = `images/${entry.base}.${ext}`;
    }
    tryNext();
  }

  function applyFilter() {
    const showConfident = filterConfidentEl.checked;
    const showLearning = filterLearningEl.checked;
    const topicWordIds = currentTopic ? new Set(currentTopic.word_ids) : null;

    ENTRIES = ALL_ENTRIES.filter((e) => {
      if (topicWordIds && !topicWordIds.has(e.wordId)) return false;
      return (e.confident && showConfident) || (!e.confident && showLearning);
    });
    index = 0;
    updateVisibility();
  }

  function updateVisibility() {
    if (ENTRIES.length === 0) {
      cardEl.style.display = "none";
      progressEl.style.display = "none";
      controlsEl.style.display = "none";
      actionBarEl.style.display = "none";
      emptyStateEl.style.display = "block";
      counterEl.textContent = "0 / 0";
      badgeEl.style.display = "none";
    } else {
      cardEl.style.display = "flex";
      progressEl.style.display = "block";
      controlsEl.style.display = "flex";
      actionBarEl.style.display = "flex";
      emptyStateEl.style.display = "none";
      badgeEl.style.display = "inline";
      render();
    }
  }

  function render() {
    if (ENTRIES.length === 0) return;
    const entry = ENTRIES[index];
    loadImage(entry);

    sentenceEl.textContent = entry.sentence;
    cueEl.textContent = entry.cue;

    revealed = false;
    wordEl.textContent = formatWordByGender(entry.word, entry.genderId);
    wordEl.style.color = getGender(entry.genderId).color || "";
    wordEl.classList.add("hidden-word");

    counterEl.textContent = `${index + 1} / ${ENTRIES.length}`;
    badgeEl.textContent = entry.confident ? "confident" : "learning";
    badgeEl.className = "badge " + (entry.confident ? "confident" : "learning");

    progressFill.style.width = `${((index + 1) / ENTRIES.length) * 100}%`;
  }

  function recordShown(entry) {
    performWrite("increment", USER_EMAIL, LANG, entry.wordId);
  }

  function next() {
    if (ENTRIES.length === 0) return;
    index = (index + 1) % ENTRIES.length;
    render();
  }
  function prev() {
    if (ENTRIES.length === 0) return;
    index = (index - 1 + ENTRIES.length) % ENTRIES.length;
    render();
  }
  function toggleReveal() {
    revealed = !revealed;
    wordEl.classList.toggle("hidden-word", !revealed);
  }

  function markShownAndAdvance() {
    if (ENTRIES.length === 0) return;
    recordShown(ENTRIES[index]);
    next();
  }

  function markKnownAndAdvance() {
    if (ENTRIES.length === 0) return;
    const entry = ENTRIES[index];

    performWrite("mark-known", USER_EMAIL, LANG, entry.wordId);

    entry.show = false;
    ALL_ENTRIES = ALL_ENTRIES.filter((e) => e.word !== entry.word);
    ENTRIES = ENTRIES.filter((e) => e.word !== entry.word);
    HIDDEN_ENTRIES.push(entry);
    HIDDEN_ENTRIES.sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
    renderHiddenList();
    if (index >= ENTRIES.length) index = 0;
    updateVisibility();
  }

  function unhideWord(entry) {
    performWrite("show-word", USER_EMAIL, LANG, entry.wordId);

    entry.show = true;
    HIDDEN_ENTRIES = HIDDEN_ENTRIES.filter((e) => e.word !== entry.word);
    ALL_ENTRIES.push(entry);
    ALL_ENTRIES.sort((a, b) => a.shownCount - b.shownCount);
    renderHiddenList();
    applyFilter();
  }

  function renderHiddenList() {
    hiddenListEl.innerHTML = "";
    const topicWordIds = currentTopic ? new Set(currentTopic.word_ids) : null;
    const visible = topicWordIds ? HIDDEN_ENTRIES.filter((e) => topicWordIds.has(e.wordId)) : HIDDEN_ENTRIES;
    if (visible.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hidden-words-empty";
      empty.textContent = "No hidden words yet.";
      hiddenListEl.appendChild(empty);
      return;
    }
    for (const entry of visible) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "hidden-word-chip";
      chip.textContent = entry.word;
      chip.title = "Click to show this word again";
      chip.addEventListener("click", () => unhideWord(entry));
      hiddenListEl.appendChild(chip);
    }
  }

  wordEl.addEventListener("click", toggleReveal);

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  knowBtn.addEventListener("click", markKnownAndAdvance);
  nextWordBtn.addEventListener("click", markShownAndAdvance);

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev(); }
    else if (e.key === " ") { e.preventDefault(); markShownAndAdvance(); }
    else if (e.key === "Enter") { e.preventDefault(); markKnownAndAdvance(); }
  });

  function handleFilterChange(e) {
    if (!filterConfidentEl.checked && !filterLearningEl.checked) {
      e.target.checked = true; // don't allow turning both off
      return;
    }
    applyFilter();
  }

  filterConfidentEl.addEventListener("change", handleFilterChange);
  filterLearningEl.addEventListener("change", handleFilterChange);

  // Background-refresh callback too: safe to call any time, re-renders from
  // whatever ALL_ENTRIES/HIDDEN_ENTRIES the new data produces.
  function applyEntries(rawWords) {
    const entries = transformWords(rawWords);
    ALL_ENTRIES = entries.filter((e) => e.show);
    HIDDEN_ENTRIES = entries.filter((e) => !e.show);
    HIDDEN_ENTRIES.sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
    renderHiddenList();
    applyFilter();
  }

  async function loadAndRenderEntries() {
    const key = cacheKey("user-words", USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG);
    const cached = readStale(key);
    if (cached) {
      applyEntries(cached.data);
      refreshInBackground({
        key,
        label: "word list",
        fetchFn: fetchRawWords,
        onFresh: applyEntries,
      });
      return;
    }

    setLoading(true);
    try {
      const rawWords = await fetchRawWords();
      writeCache(key, rawWords);
      applyEntries(rawWords);
    } finally {
      setLoading(false);
    }
  }

  load = (userEmail, lang, topic, sentenceLang, cueLang) => {
    USER_EMAIL = userEmail;
    LANG = lang;
    SENTENCE_LANG = sentenceLang || "target";
    CUE_LANG = cueLang || "origin";
    currentTopic = topic;
    return loadAndRenderEntries().catch(showError);
  };
});

defineExpose({
  load: (...args) => load(...args),
});
</script>
