<template>
  <div id="topic-reading-panel" style="display:none">
    <div class="error-banner" id="reading-error-banner"></div>

    <div class="loading" id="reading-loading">
      <div class="spinner"></div>
      <div>Loading your words…</div>
    </div>

    <div class="empty-state" id="reading-empty-state">No learning words for this topic yet.</div>

    <div class="reading-stage" id="reading-stage">
      <div class="reading-counter" id="reading-counter"></div>
      <button type="button" class="reading-word-area" id="reading-word-area">
        <span class="reading-word" id="reading-word"></span>
      </button>
      <div class="reading-hint">Tap the word for the next one</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { getUserWords } from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { readStale, refreshInBackground } from '../../shared/dataSync'
import { formatWordByGender, getGender } from '../../shared/genders'

// New tab, to the right of Sentences: a bare, one-word-at-a-time reading
// drill. Unlike Flashcards (which cycles every visible word, confident or
// not, and records progress on each), this only ever shows the topic's
// *learning* words (show !== false && !confident) — the same population as
// Flashcards' "Learning words" filter with "Confident words" unchecked.
// Tapping the word itself just advances to the next one, wrapping at the
// end; nothing here writes progress.
//
// The order is reshuffled every time this word list is (re)built — initial
// load, a background refresh landing, or reopening the tab for the same
// topic — rather than always following the topic's authored word_ids order,
// so re-reading a topic doesn't turn into memorizing a fixed sequence.
//
// Reuses Flashcards' "user-words" cache key/shape (same fetchFn/params) so
// switching between the two tabs for the same topic doesn't refetch.

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
let WORDS = [];
let index = 0;

let show;

onMounted(() => {
  const errorBanner = document.getElementById("reading-error-banner");
  const loadingEl = document.getElementById("reading-loading");
  const emptyStateEl = document.getElementById("reading-empty-state");
  const stageEl = document.getElementById("reading-stage");
  const counterEl = document.getElementById("reading-counter");
  const wordAreaEl = document.getElementById("reading-word-area");
  const wordEl = document.getElementById("reading-word");

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

  function render() {
    if (WORDS.length === 0) {
      stageEl.style.display = "none";
      emptyStateEl.style.display = "block";
      return;
    }
    emptyStateEl.style.display = "none";
    stageEl.style.display = "flex";

    const entry = WORDS[index];
    counterEl.textContent = `${index + 1} / ${WORDS.length}`;
    wordEl.textContent = formatWordByGender(entry.word, entry.genderId);
    wordEl.style.color = getGender(entry.genderId).color || "";
  }

  function next() {
    if (WORDS.length === 0) return;
    index = (index + 1) % WORDS.length;
    render();
  }

  wordAreaEl.addEventListener("click", next);

  function transformAndFilter(rawWords) {
    const byId = new Map(rawWords.map((w) => [w.word_id, w]));
    const entries = (currentTopic?.word_ids || [])
      .map((id) => byId.get(id))
      .filter((w) => w && w.show !== false && !w.confident)
      .map((w) => ({ wordId: w.word_id, word: w.original, genderId: w.gender_id || "not_apply" }));
    return shuffle(entries);
  }

  function applyWords(rawWords) {
    WORDS = transformAndFilter(rawWords);
    if (index >= WORDS.length) index = 0;
    render();
  }

  async function fetchRawWords() {
    const data = await getUserWords(USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG);
    return data.words;
  }

  async function loadAndRender() {
    const key = cacheKey("user-words", USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG);
    const cached = readStale(key);
    if (cached) {
      applyWords(cached.data);
      refreshInBackground({
        key,
        label: "word list",
        fetchFn: fetchRawWords,
        onFresh: applyWords,
      });
      return;
    }

    setLoading(true);
    try {
      const rawWords = await fetchRawWords();
      writeCache(key, rawWords);
      applyWords(rawWords);
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
    return loadAndRender().catch(showError);
  };
});

defineExpose({
  show: (...args) => show(...args),
});
</script>
