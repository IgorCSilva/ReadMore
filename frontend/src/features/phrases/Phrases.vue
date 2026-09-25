<template>
  <div id="topic-phrases-panel" style="display:none">
    <div class="error-banner" id="phrases-error-banner"></div>

    <div class="loading" id="phrases-loading">
      <div class="spinner"></div>
      <div>Loading your words…</div>
    </div>

    <div class="empty-state" id="phrases-empty-state">No phrases for this topic yet.</div>

    <div class="phrases-stage" id="phrases-stage">
      <div class="phrases-counter" id="phrases-counter"></div>

      <div class="phrase-audio-area">
        <button type="button" class="phrase-audio-btn" id="phrase-audio-btn" title="Play sentence" aria-label="Play sentence">🔊</button>
        <div class="phrase-sentence-display" id="phrase-sentence-display" style="display:none"></div>
        <button type="button" class="phrase-toggle-btn" id="phrase-toggle-btn" title="Switch view" aria-label="Switch view">👁</button>
      </div>

      <div class="phrase-options" id="phrase-options"></div>

      <button type="button" class="phrase-proceed-btn" id="phrase-proceed-btn" style="display:none">Proceed →</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { ttsUrl } from '../../shared/api'
import { speechLocaleFor } from '../../shared/languages'
import { escapeHtml } from '../../shared/text'
import { loadUserWords } from '../../shared/userWords'

// New tab, last of the reinforcement quartet (reading/dictation/quiz/
// phrases — see backend/app/application/services/reinforcement_words.py):
// listen to a natural target-language sentence (backend/content/
// <target>_sentences.json, exposed as topic.phrases) and tap the known
// words, in the order they appear, from an 8-option word bank.
//
// A "round" is one phrase. Its correct answer is phrase.word_ids in order,
// unfiltered by confident/not — unlike Reading/Dictation/Quiz, "known word"
// here means "a word you've been taught", not "a word you haven't yet
// marked confident". Rounds come from two sources: the current topic's own
// phrases (primary pool), and — for every reinforcement word_id assigned to
// this tab — one phrase pulled from THAT word's own topic (found by
// scanning allChapters), since a reinforcement word's natural sentence
// necessarily lives in the topic it was originally taught in, not this one.
//
// Wrong tap: the round locks immediately (further taps ignored), the tapped
// option turns red, the sentence view force-switches to "filled in +
// colored" (revealing the full correct order), and a Proceed button
// appears — no auto-advance. Correct full sequence: selected options get
// the target-language accent color, wait 1s, then auto-advance. Either path
// out reshuffles the next round's options and immediately plays its audio.

const OPTION_COUNT = 8;
// \p{L}\p{M} (Unicode letters + combining marks) covers every script's
// words, including Hangul — a bare Latin range would treat Korean tokens
// as non-word separators and stall the pointer walk below.
const WORD_TOKEN_RE = /[\p{L}\p{M}]+/u;
const WORD_TOKEN_RE_G = /([\p{L}\p{M}]+)/u;

function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

let USER_EMAIL = null;
let LANG = "pt-en";
let SENTENCE_LANG = "target";
let CUE_LANG = "origin";
let currentTopic = null;
let ALL_CHAPTERS = [];
let REINFORCEMENT_WORD_IDS = [];
let ROUNDS = [];
let POOL = [];
let index = 0;

let show;
let pause;

onMounted(() => {
  const errorBanner = document.getElementById("phrases-error-banner");
  const loadingEl = document.getElementById("phrases-loading");
  const emptyStateEl = document.getElementById("phrases-empty-state");
  const stageEl = document.getElementById("phrases-stage");
  const counterEl = document.getElementById("phrases-counter");
  const audioBtn = document.getElementById("phrase-audio-btn");
  const sentenceDisplayEl = document.getElementById("phrase-sentence-display");
  const toggleBtn = document.getElementById("phrase-toggle-btn");
  const optionsEl = document.getElementById("phrase-options");
  const proceedBtn = document.getElementById("phrase-proceed-btn");

  let currentAudio = null;
  let advanceTimer = null;
  let viewState = "audio"; // "audio" | "blanks" | "filled"
  let roundState = null; // { correctWords, nextExpectedIndex, failed, completed, options }
  // Optional hook so a caller (e.g. ListenIdentifyPage's own progress bar,
  // which has no other way to see the round index) can observe playback
  // advancing — called with (currentRound1Based, totalRounds), and (0, 0)
  // for the empty-state case. Unused by the plain Phrases tab in
  // LibraryPage.vue, which reads #phrases-counter's text instead.
  let onProgress = null;

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

  function targetLangCode() {
    const [, target] = LANG.split("-");
    return target || LANG;
  }

  function speakSentenceLocal(text, langCode) {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocaleFor(langCode);
    window.speechSynthesis.speak(utterance);
  }

  function playAudio(text) {
    if (!text) return;
    const langCode = targetLangCode();
    const audio = new Audio(ttsUrl(text, langCode));
    currentAudio = audio;
    audio.addEventListener("error", () => { speakSentenceLocal(text, langCode); });
    Promise.resolve(audio.play()).catch(() => { speakSentenceLocal(text, langCode); });
  }

  function stopAudio() {
    window.speechSynthesis?.cancel();
    currentAudio?.pause();
  }

  function findOwningTopic(wordId) {
    for (const chapter of ALL_CHAPTERS) {
      for (const topic of chapter.topics) {
        if (topic.word_ids.includes(wordId)) return topic;
      }
    }
    return null;
  }

  function buildRounds(rawWords) {
    const byId = new Map(rawWords.map((w) => [w.word_id, w]));
    const reinforcementSet = new Set(REINFORCEMENT_WORD_IDS);
    const seenPhraseIds = new Set();
    const rounds = [];

    function addRound(phrase) {
      if (!phrase || seenPhraseIds.has(phrase.id)) return;
      const correctWords = phrase.word_ids
        .map((id) => byId.get(id))
        .filter((w) => w)
        .map((w) => ({
          wordId: w.word_id,
          word: w.original,
          genderId: w.gender_id || "not_apply",
          isReinforcement: reinforcementSet.has(w.word_id),
        }));
      if (correctWords.length === 0) return;
      seenPhraseIds.add(phrase.id);
      rounds.push({ phraseId: phrase.id, sentence: phrase.sentence, correctWords });
    }

    for (const phrase of currentTopic?.phrases || []) addRound(phrase);

    for (const wordId of reinforcementSet) {
      const owningTopic = findOwningTopic(wordId);
      const phrase = (owningTopic?.phrases || []).find((p) => p.word_ids.includes(wordId));
      addRound(phrase);
    }

    return shuffle(rounds);
  }

  function buildPool(rawWords) {
    const byId = new Map(rawWords.map((w) => [w.word_id, w]));
    const reinforcementSet = new Set(REINFORCEMENT_WORD_IDS);
    const ids = new Set([...(currentTopic?.word_ids || []), ...reinforcementSet]);
    // Reinforcement words bypass the show!==false filter — see Reading.vue's
    // transformAndFilter for the same reasoning.
    return [...ids]
      .map((id) => byId.get(id))
      .filter((w) => w && (w.show !== false || reinforcementSet.has(w.word_id)))
      .map((w) => ({
        wordId: w.word_id,
        word: w.original,
        genderId: w.gender_id || "not_apply",
        isReinforcement: reinforcementSet.has(w.word_id),
      }));
  }

  function buildOptionsList(round) {
    const correctIds = new Set(round.correctWords.map((w) => w.wordId));
    const distractorPool = shuffle(POOL.filter((e) => !correctIds.has(e.wordId)));
    const need = Math.max(0, OPTION_COUNT - round.correctWords.length);
    const distractors = distractorPool.slice(0, need);
    return shuffle([...round.correctWords, ...distractors]);
  }

  // Tokenizes the sentence into alternating separator/word chunks, walking
  // round.correctWords in order to find each one's occurrence — same
  // approach used to author/verify content/es_sentences.json's own word_ids.
  function renderSentenceHtml(round, mode) {
    const tokens = round.sentence.split(WORD_TOKEN_RE_G);
    const correctWords = round.correctWords;
    let pointer = 0;
    let html = "";
    for (const token of tokens) {
      const expected = correctWords[pointer];
      if (
        expected &&
        WORD_TOKEN_RE.test(token) &&
        token.toLowerCase() === expected.word.toLowerCase()
      ) {
        pointer++;
        if (mode === "blanks") {
          html += `<span class="phrase-blank">____</span>`;
        } else {
          html += `<strong class="phrase-revealed-word" style="color:var(--accent-strong)">${escapeHtml(token)}</strong>`;
        }
      } else {
        html += escapeHtml(token);
      }
    }
    return html;
  }

  function renderAudioArea() {
    const round = ROUNDS[index];
    if (viewState === "audio") {
      audioBtn.style.display = "flex";
      sentenceDisplayEl.style.display = "none";
    } else {
      audioBtn.style.display = "none";
      sentenceDisplayEl.style.display = "block";
      sentenceDisplayEl.innerHTML = renderSentenceHtml(round, viewState);
    }
  }

  function cycleView() {
    viewState = viewState === "audio" ? "blanks" : viewState === "blanks" ? "filled" : "audio";
    renderAudioArea();
  }

  function markOptionComplete() {
    for (const o of roundState.options) {
      if (roundState.correctWords.some((w) => w.wordId === o.wordId)) {
        o.btn.classList.add("phrase-option-correct");
      }
    }
  }

  function handleTap(option, btn, orderBadge) {
    if (roundState.failed || roundState.completed) return;
    const expected = roundState.correctWords[roundState.nextExpectedIndex];

    if (expected && option.wordId === expected.wordId) {
      btn.classList.remove("dimmed");
      roundState.nextExpectedIndex++;
      orderBadge.textContent = String(roundState.nextExpectedIndex);
      orderBadge.style.display = "flex";
      if (roundState.nextExpectedIndex === roundState.correctWords.length) {
        roundState.completed = true;
        markOptionComplete();
        advanceTimer = window.setTimeout(advance, 1000);
      }
      return;
    }

    roundState.failed = true;
    btn.classList.remove("dimmed");
    btn.classList.add("phrase-option-wrong");
    viewState = "filled";
    renderAudioArea();
    proceedBtn.style.display = "flex";
  }

  function renderOptions(round) {
    optionsEl.innerHTML = "";
    const options = buildOptionsList(round);
    roundState.options = options.map((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "phrase-option dimmed";

      const label = document.createElement("span");
      label.className = "phrase-option-label";
      label.textContent = option.word;
      btn.appendChild(label);

      if (option.isReinforcement) {
        const reinforcementBadge = document.createElement("span");
        reinforcementBadge.className = "reinforcement-badge";
        reinforcementBadge.textContent = "\u{1F4AA}";
        reinforcementBadge.title = "Reinforcement word";
        btn.appendChild(reinforcementBadge);
      }

      const orderBadge = document.createElement("span");
      orderBadge.className = "phrase-option-order-badge";
      orderBadge.style.display = "none";
      btn.appendChild(orderBadge);

      btn.addEventListener("click", () => handleTap(option, btn, orderBadge));
      optionsEl.appendChild(btn);
      return { btn, wordId: option.wordId };
    });
  }

  function loadRound() {
    window.clearTimeout(advanceTimer);
    const round = ROUNDS[index];
    counterEl.textContent = `${index + 1} / ${ROUNDS.length}`;
    onProgress?.(index + 1, ROUNDS.length);
    viewState = "audio";
    roundState = { correctWords: round.correctWords, nextExpectedIndex: 0, failed: false, completed: false, options: [] };
    renderAudioArea();
    renderOptions(round);
    proceedBtn.style.display = "none";
    playAudio(round.sentence);
  }

  function advance() {
    window.clearTimeout(advanceTimer);
    index = (index + 1) % ROUNDS.length;
    loadRound();
  }

  audioBtn.addEventListener("click", () => playAudio(ROUNDS[index]?.sentence));
  toggleBtn.addEventListener("click", cycleView);
  proceedBtn.addEventListener("click", advance);

  function renderStage() {
    window.clearTimeout(advanceTimer);
    if (ROUNDS.length === 0) {
      stageEl.style.display = "none";
      emptyStateEl.style.display = "block";
      onProgress?.(0, 0);
      return;
    }
    emptyStateEl.style.display = "none";
    stageEl.style.display = "flex";
    loadRound();
  }

  function applyWords(rawWords) {
    ROUNDS = buildRounds(rawWords);
    POOL = buildPool(rawWords);
    if (index >= ROUNDS.length) index = 0;
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

  show = (userEmail, lang, topic, sentenceLang, cueLang, allChapters, reinforcementWordIds, onProgressCallback, startIndex) => {
    USER_EMAIL = userEmail;
    LANG = lang;
    SENTENCE_LANG = sentenceLang || "target";
    CUE_LANG = cueLang || "origin";
    currentTopic = topic;
    ALL_CHAPTERS = allChapters || [];
    REINFORCEMENT_WORD_IDS = reinforcementWordIds || [];
    onProgress = onProgressCallback || null;
    index = startIndex || 0;
    return loadAndStart().catch(showError);
  };

  // Called by the shell when the user switches to a different tab, same
  // reason as Dictation/Quiz: don't keep audio playing or a round
  // auto-advancing while off-screen.
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
