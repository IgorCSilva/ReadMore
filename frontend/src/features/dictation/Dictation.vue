<template>
  <div id="topic-dictation-panel" style="display:none">
    <div class="error-banner" id="dictation-error-banner"></div>

    <div class="loading" id="dictation-loading">
      <div class="spinner"></div>
      <div>Loading your words…</div>
    </div>

    <div class="empty-state" id="dictation-empty-state">No learning words for this topic yet.</div>

    <div class="dictation-stage" id="dictation-stage">
      <div class="dictation-counter" id="dictation-counter"></div>

      <div class="dictation-reveal-area">
        <button type="button" class="dictation-audio-btn" id="dictation-audio-btn" title="Play pronunciation" aria-label="Play pronunciation">🔊</button>
        <div class="dictation-result-word" id="dictation-result-word"></div>
      </div>

      <input type="text" class="dictation-input" id="dictation-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">

      <div class="dictation-hint">Listen, then type the word</div>
    </div>

    <button type="button" class="dictation-check-btn" id="dictation-check-btn" title="Check answer" aria-label="Check answer">✓</button>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { getUserWords, ttsUrl } from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { readStale, refreshInBackground } from '../../shared/dataSync'
import { speechLocaleFor } from '../../shared/languages'

// New tab, to the right of Typing: hear a word (TTS), type it back, then
// check per-letter accuracy against the target spelling. Word pool is the
// same "learning words for this topic" population as Reading/Typing (show
// !== false && !confident), reshuffled the same way as Reading. Like
// Reading/Typing (and unlike Flashcards), this tab never writes progress —
// it's a drill, not a review action.
//
// Word text is the raw `original` spelling, not gender-formatted — same
// choice Typing.vue makes and for the same reason: the user must type the
// literal target string, so a display-only gender toggle can't change what
// counts as "correct".
//
// Checking is per-index, not a Levenshtein diff: at each position, a
// matching letter (NFC-normalized, case-insensitive, with ' ‘ ’ `
// folded together so French elisions like "l'ecole" aren't penalized for
// quote-character style) renders in the target-language accent color; a
// position typed but wrong (or typed beyond the target's length) renders
// the *typed* letter, in red and smaller, since it "wouldn't be there";
// a position not yet typed renders the target's letter, grayed out. The
// diff is computed once per check-button click, not live while the user
// backspaces/retypes afterward.

function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const APOSTROPHE_VARIANTS = /[‘’`]/g;

function normalizeChar(ch) {
  return ch.normalize("NFC").toLowerCase().replace(APOSTROPHE_VARIANTS, "'");
}

let USER_EMAIL = null;
let LANG = "pt-en";
let SENTENCE_LANG = "target";
let CUE_LANG = "origin";
let currentTopic = null;
let WORDS = [];
let index = 0;

let show;
let pause;

onMounted(() => {
  const errorBanner = document.getElementById("dictation-error-banner");
  const loadingEl = document.getElementById("dictation-loading");
  const emptyStateEl = document.getElementById("dictation-empty-state");
  const stageEl = document.getElementById("dictation-stage");
  const counterEl = document.getElementById("dictation-counter");
  const audioBtn = document.getElementById("dictation-audio-btn");
  const resultWordEl = document.getElementById("dictation-result-word");
  const inputEl = document.getElementById("dictation-input");
  const checkBtn = document.getElementById("dictation-check-btn");

  const SPEECH_SUPPORTED = "speechSynthesis" in window;
  let currentAudio = null;
  let advanceTimer = null;

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
      checkBtn.style.display = "none";
      emptyStateEl.style.display = "none";
    }
  }

  // LANG is "origin-target" (e.g. "pt-es"); the word itself is always in
  // the target language regardless of which language SENTENCE_LANG/CUE_LANG
  // currently point at — same convention as Flashcards' targetLangCode().
  function targetLangCode() {
    const [, target] = LANG.split("-");
    return target || LANG;
  }

  function speakWordLocal(text, langCode) {
    if (!SPEECH_SUPPORTED || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocaleFor(langCode);
    window.speechSynthesis.speak(utterance);
  }

  function speakWord(text, langCode) {
    if (!text) return;
    const audio = new Audio(ttsUrl(text, langCode));
    currentAudio = audio;
    audio.addEventListener("error", () => { speakWordLocal(text, langCode); });
    // Wrapped in Promise.resolve() rather than calling audio.play().catch()
    // directly: every real browser's play() returns a Promise, but jsdom's
    // (used by this component's tests) returns undefined, which would throw
    // synchronously on .catch() and abort loadWord() before it finishes.
    Promise.resolve(audio.play()).catch(() => { speakWordLocal(text, langCode); });
  }

  function stopAudio() {
    window.speechSynthesis?.cancel();
    currentAudio?.pause();
  }

  function isWordCorrect(typed, target) {
    if (typed.length !== target.length) return false;
    for (let i = 0; i < target.length; i++) {
      if (normalizeChar(typed[i]) !== normalizeChar(target[i])) return false;
    }
    return true;
  }

  // A plain index-by-index compare falls apart on a single missing/extra
  // letter: everything after that point shifts out of alignment and reads
  // as "wrong" even though it was typed correctly (e.g. "poato" vs
  // "potato" would flag "ato" as wrong instead of recognizing just the
  // missing "t"). Aligning via the longest common subsequence, like a text
  // diff, fixes that: typed letters that appear in-order in the target are
  // "correct" wherever they fall, a target letter with no counterpart is
  // "missing", and a typed letter with no counterpart is "wrong" (extra).
  function buildAlignment(typed, target) {
    const typedChars = Array.from(typed.normalize("NFC"));
    const targetChars = Array.from(target.normalize("NFC"));
    const normTyped = typedChars.map(normalizeChar);
    const normTarget = targetChars.map(normalizeChar);
    const n = typedChars.length;
    const m = targetChars.length;

    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i][j] = normTyped[i - 1] === normTarget[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const ops = [];
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && normTyped[i - 1] === normTarget[j - 1]) {
        ops.push({ type: "correct", char: targetChars[j - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: "missing", char: targetChars[j - 1] });
        j--;
      } else {
        ops.push({ type: "wrong", char: typedChars[i - 1] });
        i--;
      }
    }
    ops.reverse();
    return ops;
  }

  // A plain space has no visible glyph of its own — coloring it red/gray is
  // invisible against the page background, so a missing or extra space
  // would silently vanish from the diff instead of being flagged. Only
  // swapped in for non-correct positions: a *correct* space (mid-target
  // vocabulary like "de nada" has a real space) should still read as a
  // natural word gap, not get marked up.
  const VISIBLE_SPACE = "␣";

  function renderDiff(typed, target) {
    resultWordEl.innerHTML = "";
    for (const op of buildAlignment(typed, target)) {
      const span = document.createElement("span");
      span.classList.add(`dictation-letter-${op.type}`);
      span.textContent = op.type !== "correct" && op.char === " " ? VISIBLE_SPACE : op.char;
      resultWordEl.appendChild(span);
    }
  }

  function currentEntry() {
    return WORDS[index];
  }

  function loadWord() {
    window.clearTimeout(advanceTimer);
    counterEl.textContent = `${index + 1} / ${WORDS.length}`;
    inputEl.value = "";
    resultWordEl.innerHTML = "";
    resultWordEl.style.display = "none";
    audioBtn.style.display = "flex";
    checkBtn.disabled = false;
    inputEl.focus({ preventScroll: true });
    speakWord(currentEntry().word, targetLangCode());
  }

  function advance() {
    index = (index + 1) % WORDS.length;
    loadWord();
  }

  function handleCheck() {
    if (WORDS.length === 0) return;
    const entry = currentEntry();
    const typed = inputEl.value;
    audioBtn.style.display = "none";
    resultWordEl.style.display = "flex";
    renderDiff(typed, entry.word);
    if (isWordCorrect(typed, entry.word)) {
      checkBtn.disabled = true;
      advanceTimer = window.setTimeout(advance, 1000);
    }
  }

  checkBtn.addEventListener("click", handleCheck);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCheck();
    }
  });
  audioBtn.addEventListener("click", () => {
    const entry = currentEntry();
    if (entry) speakWord(entry.word, targetLangCode());
  });

  function renderStage() {
    window.clearTimeout(advanceTimer);
    if (WORDS.length === 0) {
      stageEl.style.display = "none";
      checkBtn.style.display = "none";
      emptyStateEl.style.display = "block";
      return;
    }
    emptyStateEl.style.display = "none";
    stageEl.style.display = "flex";
    checkBtn.style.display = "flex";
    loadWord();
  }

  function transformAndFilter(rawWords) {
    const byId = new Map(rawWords.map((w) => [w.word_id, w]));
    const entries = (currentTopic?.word_ids || [])
      .map((id) => byId.get(id))
      .filter((w) => w && w.show !== false && !w.confident)
      .map((w) => ({ wordId: w.word_id, word: w.original }));
    return shuffle(entries);
  }

  function applyWords(rawWords) {
    WORDS = transformAndFilter(rawWords);
    if (index >= WORDS.length) index = 0;
  }

  async function fetchRawWords() {
    const data = await getUserWords(USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG);
    return data.words;
  }

  async function loadAndStart() {
    const key = cacheKey("user-words", USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG);
    const cached = readStale(key);
    if (cached) {
      applyWords(cached.data);
      renderStage();
      refreshInBackground({
        key,
        label: "word list",
        fetchFn: fetchRawWords,
        // Only (re)starts the stage if there was no word list yet — once the
        // user is mid-round, a background refresh landing shouldn't reshuffle
        // the pool out from under an in-progress typed answer.
        onFresh: (rawWords) => {
          const hadWords = WORDS.length > 0;
          applyWords(rawWords);
          if (!hadWords) renderStage();
        },
      });
      return;
    }

    setLoading(true);
    try {
      const rawWords = await fetchRawWords();
      writeCache(key, rawWords);
      applyWords(rawWords);
      renderStage();
    } finally {
      setLoading(false);
    }
  }

  show = (userEmail, lang, topic, sentenceLang, cueLang) => {
    USER_EMAIL = userEmail;
    LANG = lang;
    SENTENCE_LANG = sentenceLang || "target";
    CUE_LANG = cueLang || "origin";
    currentTopic = topic;
    index = 0;
    return loadAndStart().catch(showError);
  };

  // Called by the shell when the user switches to a different tab, so a
  // word's TTS audio doesn't keep playing in the background off-screen.
  pause = () => {
    window.clearTimeout(advanceTimer);
    stopAudio();
  };
});

defineExpose({
  show: (...args) => show(...args),
  pause: () => pause(),
});
</script>
