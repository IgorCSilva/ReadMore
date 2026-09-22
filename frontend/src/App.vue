<template>

  <Notifications />

  <CorrectSentenceFab />

  <UpdateAvailableBanner ref="updateBannerRef" />

  <div class="global-topbar" id="global-topbar">
    <div class="global-topbar-user">
      <span class="topbar-user-email" id="current-user-email"></span>
      <button type="button" class="switch-user-btn" id="switch-user-btn">Log in with another email</button>
    </div>
    <select id="lang-select"></select>
    <label class="lang-choice-label">Sentence: <select id="sentence-lang-select"></select></label>
    <label class="lang-choice-label">Cue: <select id="cue-lang-select"></select></label>
    <label class="lang-choice-label gender-style-toggle">
      <input type="checkbox" id="gender-style-texts-checkbox">
      Gender style in texts
    </label>
  </div>

  <div class="texts-page">
    <div class="breadcrumb" id="texts-breadcrumb"></div>

    <div class="error-banner" id="texts-error-banner"></div>

    <div class="loading" id="texts-loading">
      <div class="spinner"></div>
      <div>Loading chapters…</div>
    </div>

    <div class="empty-state" id="texts-empty-state">No chapters available yet.</div>

    <div class="item-list" id="chapters-list" style="display:none"></div>

    <div class="item-list" id="topics-list" style="display:none"></div>

    <div id="topic-workspace" style="display:none">
      <div class="tabs" id="topic-tabs">
        <button type="button" class="tab-btn active" id="topic-tab-flashcards" data-tab="flashcards">Flashcards</button>
        <button type="button" class="tab-btn" id="topic-tab-texts" data-tab="texts" style="display:none">Texts</button>
        <button type="button" class="tab-btn" id="topic-tab-sentences" data-tab="sentences">Sentences</button>
        <button type="button" class="tab-btn" id="topic-tab-reading" data-tab="reading">Reading</button>
        <button type="button" class="tab-btn" id="topic-tab-typing" data-tab="typing">Typing</button>
        <button type="button" class="tab-btn" id="topic-tab-dictation" data-tab="dictation">Dictation</button>
        <button type="button" class="tab-btn" id="topic-tab-quiz" data-tab="quiz">Quiz</button>
        <button type="button" class="tab-btn" id="topic-tab-phrases" data-tab="phrases">Phrases</button>
        <button type="button" class="tab-btn" id="topic-tab-exercises" data-tab="exercises">Exercises</button>
        <button type="button" class="tab-btn" id="topic-tab-game" data-tab="game">Game</button>
        <button type="button" class="tab-btn" id="topic-tab-reinforcement" data-tab="reinforcement">Reinforcement</button>
      </div>

      <div class="tabs" id="reinforcement-tabs" style="display:none">
        <button type="button" class="tab-btn active" id="reinforcement-tab-reading" data-tab="reading">Reading</button>
        <button type="button" class="tab-btn" id="reinforcement-tab-dictation" data-tab="dictation">Dictation</button>
        <button type="button" class="tab-btn" id="reinforcement-tab-quiz" data-tab="quiz">Quiz</button>
        <button type="button" class="tab-btn" id="reinforcement-tab-phrases" data-tab="phrases">Phrases</button>
      </div>

      <Flashcards ref="flashcardsRef" />

      <Texts ref="textsRef" />

      <Sentences ref="sentencesRef" />

      <Reading ref="readingRef" />

      <Typing ref="typingRef" />

      <Dictation ref="dictationRef" />

      <Quiz ref="quizRef" />

      <Phrases ref="phrasesRef" />

      <Exercises ref="exercisesRef" />

      <Game ref="gameRef" />
    </div>
  </div>

</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getChapters, getLanguages, getReinforcementWords } from './shared/api'
import { cacheKey, writeCache } from './shared/cache'
import { setCurrentSelection } from './shared/currentSelection'
import { readStale, refreshInBackground } from './shared/dataSync'
import { formatLanguagePairLabel, formatLanguageName } from './shared/languages'
import { escapeHtml } from './shared/text'
import { flushQueuedWrites } from './shared/writeQueue'
import CorrectSentenceFab from './features/corrections/CorrectSentenceFab.vue'
import Flashcards from './features/catalog/Flashcards.vue'
import Notifications from './shared/Notifications.vue'
import UpdateAvailableBanner from './shared/UpdateAvailableBanner.vue'
import Texts from './features/texts/Texts.vue'
import Sentences from './features/sentences/Sentences.vue'
import Reading from './features/reading/Reading.vue'
import Typing from './features/typing/Typing.vue'
import Dictation from './features/dictation/Dictation.vue'
import Quiz from './features/quiz/Quiz.vue'
import Phrases from './features/phrases/Phrases.vue'
import Exercises from './features/exercises/Exercises.vue'
import Game from './features/game/Game.vue'

// Template refs to the tab children — declared at top level (not inside
// onMounted) since Vue only binds template refs (ref="..." in the template
// above) to variables visible at setup() scope.
const flashcardsRef = ref(null)
const textsRef = ref(null)
const sentencesRef = ref(null)
const readingRef = ref(null)
const typingRef = ref(null)
const dictationRef = ref(null)
const quizRef = ref(null)
const phrasesRef = ref(null)
const exercisesRef = ref(null)
const gameRef = ref(null)
const updateBannerRef = ref(null)

// Lifted from viewer.html's end-of-body <script> unchanged (Step 2.1 of
// RESTRUCTURE_PLAN.md Phase 2 — behavior-preserving re-platform, not a
// rewrite). Wrapped in onMounted() since Vue mounts the template
// asynchronously, unlike a plain end-of-body script that ran once the
// browser had already parsed the DOM synchronously above it — onMounted
// fires at the equivalent point once Vue's own DOM is in place.
onMounted(() => {

  const EMAIL_STORAGE_KEY = "readmore_user_email";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const GENDER_STYLE_TEXTS_STORAGE_KEY = "readmore_gender_style_texts";

  let USER_EMAIL = null;
  let LANG = "pt-en";
  let SENTENCE_LANG = "target";
  let CUE_LANG = "origin";
  let GENDER_STYLE_TEXTS = localStorage.getItem(GENDER_STYLE_TEXTS_STORAGE_KEY) === "true";

  const langSelectEl = document.getElementById("lang-select");
  const sentenceLangSelectEl = document.getElementById("sentence-lang-select");
  const cueLangSelectEl = document.getElementById("cue-lang-select");
  const genderStyleTextsCheckbox = document.getElementById("gender-style-texts-checkbox");
  const currentUserEmailEl = document.getElementById("current-user-email");
  const switchUserBtn = document.getElementById("switch-user-btn");

  genderStyleTextsCheckbox.checked = GENDER_STYLE_TEXTS;
  genderStyleTextsCheckbox.addEventListener("change", () => {
    GENDER_STYLE_TEXTS = genderStyleTextsCheckbox.checked;
    localStorage.setItem(GENDER_STYLE_TEXTS_STORAGE_KEY, String(GENDER_STYLE_TEXTS));
    switchTopicTab(currentTopicTab);
  });

  function promptForEmail(message) {
    let email = null;
    while (!email || !EMAIL_RE.test(email)) {
      email = window.prompt(message);
      if (email === null) continue; // keep asking, there's no usable default
      email = email.trim();
    }
    return email;
  }

  function setUserEmail(email) {
    USER_EMAIL = email;
    localStorage.setItem(EMAIL_STORAGE_KEY, email);
    currentUserEmailEl.textContent = email;
  }

  function getUserEmail() {
    const stored = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (stored && EMAIL_RE.test(stored)) return stored;
    return promptForEmail("Enter your email to load your word list:");
  }

  async function switchUser() {
    const email = promptForEmail("Enter the email to log in with:");
    setUserEmail(email);
    await loadAndRenderChapters();
    syncHash(false);
  }

  switchUserBtn.addEventListener("click", switchUser);

  // Writes made while offline sit in a local queue (see shared/writeQueue.ts)
  // until they can be retried: once on load (in case any were queued from a
  // previous session and we're already back online), whenever the browser
  // reports connectivity again, and on a slow interval as a fallback for the
  // cases where the "online" event doesn't fire reliably. flushQueuedWrites()
  // is a cheap no-op when the queue is empty, so the interval costs nothing
  // in the common case.
  flushQueuedWrites();
  window.addEventListener("online", flushQueuedWrites);
  setInterval(flushQueuedWrites, 30000);

  async function loadLanguages() {
    const data = await getLanguages();
    return data.languages || [];
  }

  // Drives which of the CSS accent trios (--accent/-soft/-strong, defined
  // in the <style> block's :root[data-lang=...] rules) is active — every
  // component that reads var(--accent) picks this up automatically, no
  // other wiring needed. Falls back to "en" for a target this app doesn't
  // have its own accent for yet, rather than leaving data-lang unset.
  function setDataLang() {
    const [, target] = LANG.split("-");
    document.documentElement.setAttribute("data-lang", target === "es" ? "es" : "en");
  }

  // Sentence/cue language pickers only ever offer the current pair's own
  // two languages ("origin" or "target") — never an unrelated language, per
  // the app's own restriction (a pt-en learner can't pick Spanish here).
  function populateLangChoiceSelects() {
    const [origin, target] = LANG.split("-");
    const originLabel = formatLanguageName(origin);
    const targetLabel = formatLanguageName(target);

    function fillSelect(selectEl, selected) {
      selectEl.innerHTML = "";
      const originOpt = document.createElement("option");
      originOpt.value = "origin";
      originOpt.textContent = originLabel;
      const targetOpt = document.createElement("option");
      targetOpt.value = "target";
      targetOpt.textContent = targetLabel;
      selectEl.appendChild(originOpt);
      selectEl.appendChild(targetOpt);
      selectEl.value = selected;
    }

    fillSelect(sentenceLangSelectEl, SENTENCE_LANG);
    fillSelect(cueLangSelectEl, CUE_LANG);
  }

  langSelectEl.addEventListener("change", async () => {
    LANG = langSelectEl.value;
    setDataLang();
    populateLangChoiceSelects();
    await loadAndRenderChapters();
    syncHash(false);
  });

  sentenceLangSelectEl.addEventListener("change", () => {
    SENTENCE_LANG = sentenceLangSelectEl.value;
    watchUpdateBanner();
    switchTopicTab(currentTopicTab);
  });

  cueLangSelectEl.addEventListener("change", () => {
    CUE_LANG = cueLangSelectEl.value;
    watchUpdateBanner();
    switchTopicTab(currentTopicTab);
  });

  // ---- Topic workspace tabs (Flashcards / Texts within a topic) ----

  let currentTopicTab = "flashcards";
  // Which of the Reinforcement tab's own sub-tabs (reusing the Reading/
  // Dictation/Quiz/Phrases panels/components below) is active — only
  // meaningful while currentTopicTab === "reinforcement".
  let currentReinforcementSubTab = "reading";
  const REINFORCEMENT_SUB_TABS = ["reading", "dictation", "quiz", "phrases"];
  // Passed as the `topic` arg to Reading/Dictation/Quiz/Phrases' show() when
  // driving them from the Reinforcement tab, so their own transformAndFilter/
  // buildPool/buildRounds logic (unchanged) sees no topic word_ids of its
  // own and renders reinforcement words only — see each component's
  // transformAndFilter/buildPool for how an empty word_ids list falls
  // through to just the reinforcement entries.
  const EMPTY_TOPIC = { word_ids: [] };
  const topicWorkspaceEl = document.getElementById("topic-workspace");
  const topicTabFlashcardsBtn = document.getElementById("topic-tab-flashcards");
  const topicTabTextsBtn = document.getElementById("topic-tab-texts");
  const topicTabSentencesBtn = document.getElementById("topic-tab-sentences");
  const topicTabReadingBtn = document.getElementById("topic-tab-reading");
  const topicTabTypingBtn = document.getElementById("topic-tab-typing");
  const topicTabDictationBtn = document.getElementById("topic-tab-dictation");
  const topicTabQuizBtn = document.getElementById("topic-tab-quiz");
  const topicTabPhrasesBtn = document.getElementById("topic-tab-phrases");
  const topicTabExercisesBtn = document.getElementById("topic-tab-exercises");
  const topicTabGameBtn = document.getElementById("topic-tab-game");
  const topicTabReinforcementBtn = document.getElementById("topic-tab-reinforcement");
  const reinforcementTabsEl = document.getElementById("reinforcement-tabs");
  const reinforcementTabReadingBtn = document.getElementById("reinforcement-tab-reading");
  const reinforcementTabDictationBtn = document.getElementById("reinforcement-tab-dictation");
  const reinforcementTabQuizBtn = document.getElementById("reinforcement-tab-quiz");
  const reinforcementTabPhrasesBtn = document.getElementById("reinforcement-tab-phrases");
  const topicFlashcardsPanelEl = document.getElementById("topic-flashcards-panel");
  const topicTextsPanelEl = document.getElementById("topic-texts-panel");
  const topicSentencesPanelEl = document.getElementById("topic-sentences-panel");
  const topicReadingPanelEl = document.getElementById("topic-reading-panel");
  const topicTypingPanelEl = document.getElementById("topic-typing-panel");
  const topicDictationPanelEl = document.getElementById("topic-dictation-panel");
  const topicQuizPanelEl = document.getElementById("topic-quiz-panel");
  const topicPhrasesPanelEl = document.getElementById("topic-phrases-panel");
  const topicExercisesPanelEl = document.getElementById("topic-exercises-panel");
  const topicGamePanelEl = document.getElementById("topic-game-panel");

  // Tells UpdateAvailableBanner which (user, lang, sentenceLang, cueLang)
  // key to watch for a pending shared-word-list update — called from every
  // place that establishes or changes that tuple, so the banner always
  // reflects the key actually in use. Applying the update re-invokes
  // whichever tab is currently active.
  function watchUpdateBanner() {
    updateBannerRef.value?.watch(USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG, () => switchTopicTab(currentTopicTab));
  }

  // Drives a Reading/Dictation/Quiz/Phrases panel from the Reinforcement
  // tab's sub-nav, reusing each component's own show() unchanged — passing
  // EMPTY_TOPIC means only that tab's reinforcement entries render (see
  // EMPTY_TOPIC's comment above). Pure data call; panel visibility and
  // active-button state are handled by callers (switchTopicTab /
  // switchReinforcementSubTab) so this can be reused by both.
  function showReinforcementSubTab(subTab) {
    if (subTab === "reading") {
      readingRef.value?.show(USER_EMAIL, LANG, EMPTY_TOPIC, SENTENCE_LANG, CUE_LANG, REINFORCEMENT.reading);
    } else if (subTab === "dictation") {
      dictationRef.value?.show(USER_EMAIL, LANG, EMPTY_TOPIC, SENTENCE_LANG, CUE_LANG, REINFORCEMENT.dictation);
    } else if (subTab === "quiz") {
      quizRef.value?.show(USER_EMAIL, LANG, EMPTY_TOPIC, SENTENCE_LANG, CUE_LANG, REINFORCEMENT.quiz);
    } else if (subTab === "phrases") {
      phrasesRef.value?.show(USER_EMAIL, LANG, EMPTY_TOPIC, SENTENCE_LANG, CUE_LANG, CHAPTERS, REINFORCEMENT.phrases);
    }
  }

  // Same pause-on-leave reasoning as switchTopicTab's dictation/quiz/phrases
  // checks below — needed here too since the Reinforcement tab drives those
  // same components/panels.
  function pauseReinforcementSubTab(subTab) {
    if (subTab === "dictation") dictationRef.value?.pause();
    else if (subTab === "quiz") quizRef.value?.pause();
    else if (subTab === "phrases") phrasesRef.value?.pause();
  }

  // Switches among the Reinforcement tab's own sub-tabs, without leaving
  // the Reinforcement top-level tab (see switchTopicTab for that case).
  function switchReinforcementSubTab(subTab) {
    if (currentReinforcementSubTab !== subTab) {
      pauseReinforcementSubTab(currentReinforcementSubTab);
    }
    currentReinforcementSubTab = subTab;
    reinforcementTabReadingBtn.classList.toggle("active", subTab === "reading");
    reinforcementTabDictationBtn.classList.toggle("active", subTab === "dictation");
    reinforcementTabQuizBtn.classList.toggle("active", subTab === "quiz");
    reinforcementTabPhrasesBtn.classList.toggle("active", subTab === "phrases");
    topicReadingPanelEl.style.display = subTab === "reading" ? "flex" : "none";
    topicDictationPanelEl.style.display = subTab === "dictation" ? "flex" : "none";
    topicQuizPanelEl.style.display = subTab === "quiz" ? "flex" : "none";
    topicPhrasesPanelEl.style.display = subTab === "phrases" ? "flex" : "none";
    showReinforcementSubTab(subTab);
  }

  function switchTopicTab(tab) {
    // The Reading/Dictation/Quiz/Phrases panels/components are shared
    // between their own top-level tabs and the Reinforcement tab's
    // sub-tabs — the actually-active one of the four is currentTopicTab
    // itself normally, but currentReinforcementSubTab while "reinforcement"
    // is active. Used below so leaving either path pauses the right thing.
    const prevActivePanel = currentTopicTab === "reinforcement" ? currentReinforcementSubTab : currentTopicTab;
    const nextActivePanel = tab === "reinforcement" ? currentReinforcementSubTab : tab;

    // Typing keeps a rAF loop spawning/moving words while its tab is
    // active — pause() before leaving it so an off-screen tab doesn't keep
    // spawning and missing words in the background indefinitely.
    if (currentTopicTab === "typing" && tab !== "typing") {
      typingRef.value?.pause();
    }
    // Dictation plays TTS audio for the current word — pause() before
    // leaving it so playback doesn't keep going once the tab is off-screen.
    if (prevActivePanel === "dictation" && nextActivePanel !== "dictation") {
      dictationRef.value?.pause();
    }
    // Quiz's answer round auto-advances on a timer, same reason as Dictation
    // above — pause() before leaving so it doesn't jump to the next question
    // while off-screen.
    if (prevActivePanel === "quiz" && nextActivePanel !== "quiz") {
      quizRef.value?.pause();
    }
    // Phrases plays sentence audio and auto-advances on success, same
    // reasons as Dictation/Quiz above.
    if (prevActivePanel === "phrases" && nextActivePanel !== "phrases") {
      phrasesRef.value?.pause();
    }
    // Game's Phaser scene keeps its own internal loop running while active —
    // pause() before leaving it so an off-screen tab doesn't keep simulating.
    if (currentTopicTab === "game" && tab !== "game") {
      gameRef.value?.pause();
    }
    currentTopicTab = tab;
    topicTabFlashcardsBtn.classList.toggle("active", tab === "flashcards");
    topicTabTextsBtn.classList.toggle("active", tab === "texts");
    topicTabSentencesBtn.classList.toggle("active", tab === "sentences");
    topicTabReadingBtn.classList.toggle("active", tab === "reading");
    topicTabTypingBtn.classList.toggle("active", tab === "typing");
    topicTabDictationBtn.classList.toggle("active", tab === "dictation");
    topicTabQuizBtn.classList.toggle("active", tab === "quiz");
    topicTabPhrasesBtn.classList.toggle("active", tab === "phrases");
    topicTabExercisesBtn.classList.toggle("active", tab === "exercises");
    topicTabGameBtn.classList.toggle("active", tab === "game");
    topicTabReinforcementBtn.classList.toggle("active", tab === "reinforcement");
    reinforcementTabsEl.style.display = tab === "reinforcement" ? "flex" : "none";
    if (tab === "reinforcement") {
      reinforcementTabReadingBtn.classList.toggle("active", currentReinforcementSubTab === "reading");
      reinforcementTabDictationBtn.classList.toggle("active", currentReinforcementSubTab === "dictation");
      reinforcementTabQuizBtn.classList.toggle("active", currentReinforcementSubTab === "quiz");
      reinforcementTabPhrasesBtn.classList.toggle("active", currentReinforcementSubTab === "phrases");
    }
    topicFlashcardsPanelEl.style.display = tab === "flashcards" ? "flex" : "none";
    topicTextsPanelEl.style.display = tab === "texts" ? "flex" : "none";
    topicSentencesPanelEl.style.display = tab === "sentences" ? "flex" : "none";
    topicTypingPanelEl.style.display = tab === "typing" ? "flex" : "none";
    topicExercisesPanelEl.style.display = tab === "exercises" ? "flex" : "none";
    topicGamePanelEl.style.display = tab === "game" ? "flex" : "none";
    // Reading/Dictation/Quiz/Phrases panels follow nextActivePanel rather
    // than `tab` directly, so under "reinforcement" the one matching
    // currentReinforcementSubTab stays visible instead of all four hiding.
    topicReadingPanelEl.style.display = nextActivePanel === "reading" ? "flex" : "none";
    topicDictationPanelEl.style.display = nextActivePanel === "dictation" ? "flex" : "none";
    topicQuizPanelEl.style.display = nextActivePanel === "quiz" ? "flex" : "none";
    topicPhrasesPanelEl.style.display = nextActivePanel === "phrases" ? "flex" : "none";
    if (tab === "flashcards") {
      flashcardsRef.value?.load(USER_EMAIL, LANG, currentTopic, SENTENCE_LANG, CUE_LANG);
    } else if (tab === "texts") {
      textsRef.value?.show(currentTopic, LANG, GENDER_STYLE_TEXTS);
    } else if (tab === "sentences") {
      sentencesRef.value?.show(currentTopic);
    } else if (tab === "reading") {
      readingRef.value?.show(USER_EMAIL, LANG, currentTopic, SENTENCE_LANG, CUE_LANG, REINFORCEMENT.reading);
    } else if (tab === "typing") {
      typingRef.value?.show(USER_EMAIL, LANG, currentTopic, SENTENCE_LANG, CUE_LANG);
    } else if (tab === "dictation") {
      dictationRef.value?.show(USER_EMAIL, LANG, currentTopic, SENTENCE_LANG, CUE_LANG, REINFORCEMENT.dictation);
    } else if (tab === "quiz") {
      quizRef.value?.show(USER_EMAIL, LANG, currentTopic, SENTENCE_LANG, CUE_LANG, REINFORCEMENT.quiz);
    } else if (tab === "phrases") {
      phrasesRef.value?.show(USER_EMAIL, LANG, currentTopic, SENTENCE_LANG, CUE_LANG, CHAPTERS, REINFORCEMENT.phrases);
    } else if (tab === "exercises") {
      exercisesRef.value?.show(LANG, currentTopic, CUE_LANG);
    } else if (tab === "game") {
      gameRef.value?.show(LANG, currentTopic);
    } else if (tab === "reinforcement") {
      showReinforcementSubTab(currentReinforcementSubTab);
    }
  }

  topicTabFlashcardsBtn.addEventListener("click", () => { switchTopicTab("flashcards"); syncHash(true); });
  topicTabTextsBtn.addEventListener("click", () => { switchTopicTab("texts"); syncHash(true); });
  topicTabSentencesBtn.addEventListener("click", () => { switchTopicTab("sentences"); syncHash(true); });
  topicTabReadingBtn.addEventListener("click", () => { switchTopicTab("reading"); syncHash(true); });
  topicTabTypingBtn.addEventListener("click", () => { switchTopicTab("typing"); syncHash(true); });
  topicTabDictationBtn.addEventListener("click", () => { switchTopicTab("dictation"); syncHash(true); });
  topicTabQuizBtn.addEventListener("click", () => { switchTopicTab("quiz"); syncHash(true); });
  topicTabPhrasesBtn.addEventListener("click", () => { switchTopicTab("phrases"); syncHash(true); });
  topicTabExercisesBtn.addEventListener("click", () => { switchTopicTab("exercises"); syncHash(true); });
  topicTabGameBtn.addEventListener("click", () => { switchTopicTab("game"); syncHash(true); });
  topicTabReinforcementBtn.addEventListener("click", () => { switchTopicTab("reinforcement"); syncHash(true); });
  reinforcementTabReadingBtn.addEventListener("click", () => { switchReinforcementSubTab("reading"); syncHash(true); });
  reinforcementTabDictationBtn.addEventListener("click", () => { switchReinforcementSubTab("dictation"); syncHash(true); });
  reinforcementTabQuizBtn.addEventListener("click", () => { switchReinforcementSubTab("quiz"); syncHash(true); });
  reinforcementTabPhrasesBtn.addEventListener("click", () => { switchReinforcementSubTab("phrases"); syncHash(true); });

  // ---- Texts ----

  let CHAPTERS = [];
  let currentChapter = null;
  let currentTopic = null;
  // Reinforcement word_ids for the currently-open topic, split across the
  // four REINFORCEMENT_TABS (see backend/app/application/services/
  // reinforcement_words.py) — refreshed by loadReinforcementWords()
  // whenever showTopicWorkspace opens a topic, consumed by switchTopicTab's
  // show() calls for reading/dictation/quiz/phrases.
  let REINFORCEMENT = {};

  const textsBreadcrumbEl = document.getElementById("texts-breadcrumb");
  const textsErrorBanner = document.getElementById("texts-error-banner");
  const textsLoadingEl = document.getElementById("texts-loading");
  const textsEmptyStateEl = document.getElementById("texts-empty-state");
  const chaptersListEl = document.getElementById("chapters-list");
  const topicsListEl = document.getElementById("topics-list");

  function showTextsError(err) {
    console.error(err);
    textsErrorBanner.style.display = "block";
    textsErrorBanner.innerHTML = `Couldn't load chapters (${err.message}).`;
  }

  async function fetchChapters() {
    const data = await getChapters(USER_EMAIL, LANG);
    return data.chapters || [];
  }

  // Background-refresh callback: updates the underlying data unconditionally,
  // but only re-renders the top-level chapters list if the user is still
  // looking at it — a refresh landing mid-topic-workspace shouldn't yank
  // them back out to the chapters list.
  function applyFreshChapters(chapters) {
    CHAPTERS = chapters;
    if (!currentChapter) renderChaptersList();
  }

  // restoreState (only ever passed by init(), from the page's initial URL
  // hash) makes the first render land on that chapter/topic/tab instead of
  // the chapters list — every other caller (language/user switch) omits it
  // and gets the normal reset-to-chapters-list behavior.
  async function loadAndRenderChapters(restoreState = null) {
    textsErrorBanner.style.display = "none";

    const key = cacheKey("chapters", USER_EMAIL, LANG);
    const cached = readStale(key);
    if (cached) {
      CHAPTERS = cached.data;
      currentChapter = null;
      currentTopic = null;
      applyHashState(restoreState);
      refreshInBackground({
        key,
        label: "chapters",
        fetchFn: fetchChapters,
        onFresh: applyFreshChapters,
      });
      return;
    }

    textsEmptyStateEl.style.display = "none";
    chaptersListEl.style.display = "none";
    topicsListEl.style.display = "none";
    topicWorkspaceEl.style.display = "none";
    textsLoadingEl.style.display = "flex";
    try {
      CHAPTERS = await fetchChapters();
      writeCache(key, CHAPTERS);
      currentChapter = null;
      currentTopic = null;
      applyHashState(restoreState);
    } catch (err) {
      showTextsError(err);
    } finally {
      textsLoadingEl.style.display = "none";
    }
  }

  function renderBreadcrumb() {
    setCurrentSelection({
      lang: LANG,
      chapterNumber: currentChapter?.number ?? null,
      topicNumber: currentTopic?.number ?? null,
    });

    textsBreadcrumbEl.innerHTML = "";

    const chaptersBtn = document.createElement("button");
    chaptersBtn.type = "button";
    chaptersBtn.textContent = "Chapters";
    chaptersBtn.addEventListener("click", () => { renderChaptersList(); syncHash(true); });
    textsBreadcrumbEl.appendChild(chaptersBtn);

    if (!currentChapter) return;

    textsBreadcrumbEl.appendChild(sepEl());
    if (!currentTopic) {
      textsBreadcrumbEl.appendChild(currentSpan(currentChapter.title));
      return;
    }

    const chapterBtn = document.createElement("button");
    chapterBtn.type = "button";
    chapterBtn.textContent = currentChapter.title;
    chapterBtn.addEventListener("click", () => { showTopics(currentChapter); syncHash(true); });
    textsBreadcrumbEl.appendChild(chapterBtn);

    textsBreadcrumbEl.appendChild(sepEl());
    textsBreadcrumbEl.appendChild(currentSpan(currentTopic.title));
  }

  function sepEl() {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "›";
    return sep;
  }

  function currentSpan(text) {
    const span = document.createElement("span");
    span.className = "current";
    span.textContent = text;
    return span;
  }

  function itemCard(number, title, description, status, onClick) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "item-card";
    card.innerHTML =
      `<div class="item-card-chip">${number}</div>` +
      `<div class="item-card-body">` +
      `<div class="item-card-title">${escapeHtml(title)}</div>` +
      (description ? `<div class="item-card-description">${escapeHtml(description)}</div>` : "") +
      `</div>` +
      `<div class="item-card-arrow">→</div>`;
    if (status === "in_development") {
      card.disabled = true;
    } else {
      card.addEventListener("click", onClick);
    }
    return card;
  }

  // The URL hash encodes exactly where the user is — #/<lang>/<chapterId>/
  // <topicId>/<tab> (chapter/topic/tab segments only present once drilled
  // in that far) — so a reload or a link sent to someone else lands on the
  // same chapter/topic/tab instead of always the chapters list. Kept in the
  // hash rather than a real path since the backend only serves index.html
  // for "/" (see main.py) and has no catch-all route for arbitrary paths;
  // the hash never leaves the browser, so it needs no server-side support.
  const VALID_TABS = ["flashcards", "texts", "sentences", "reading", "typing", "dictation", "quiz", "phrases", "exercises", "game", "reinforcement"];

  function buildHash() {
    const parts = [LANG];
    if (currentChapter) {
      parts.push(currentChapter.chapter_id);
      if (currentTopic) {
        parts.push(currentTopic.topic_id, currentTopicTab);
        if (currentTopicTab === "reinforcement") {
          parts.push(currentReinforcementSubTab);
        }
      }
    }
    return "#/" + parts.map(encodeURIComponent).join("/");
  }

  function parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    if (!raw) return null;
    const [lang, chapterId, topicId, tab, subTab] = raw.split("/").map((s) => decodeURIComponent(s || ""));
    if (!lang) return null;
    return { lang, chapterId: chapterId || null, topicId: topicId || null, tab: tab || null, subTab: subTab || null };
  }

  // Called after every real navigation click (chapter/topic/tab/breadcrumb)
  // so the back/forward buttons step through them — push=true adds a new
  // history entry. Language/user switches call this with push=false
  // instead: they still keep the URL in sync, but don't become a
  // back-button step, which keeps popstate below simple (it never has to
  // reload chapters for a different language, only re-navigate within the
  // currently-loaded one).
  function syncHash(push) {
    const hash = buildHash();
    if (push) {
      history.pushState(null, "", hash);
    } else {
      history.replaceState(null, "", hash);
    }
  }

  // Navigates to whatever a parsed hash describes, within the currently
  // loaded CHAPTERS — falls back a level at a time (topic missing -> its
  // chapter's topic list; chapter missing -> chapters list) rather than
  // failing outright, so a stale/tampered link still lands somewhere valid.
  function applyHashState(state) {
    if (!state || state.lang !== LANG) {
      renderChaptersList();
      return;
    }
    const chapter = CHAPTERS.find((c) => c.chapter_id === state.chapterId);
    if (!chapter) {
      renderChaptersList();
      return;
    }
    if (!state.topicId) {
      showTopics(chapter);
      return;
    }
    const topic = chapter.topics.find((t) => t.topic_id === state.topicId);
    if (!topic) {
      showTopics(chapter);
      return;
    }
    // showTopicWorkspace only sets currentTopic — in the normal click-through
    // flow currentChapter is already set by the showTopics() step the user
    // passed through to get here. Restoring can jump straight to the
    // workspace without that step, so it must set currentChapter itself.
    currentChapter = chapter;
    const tab = VALID_TABS.includes(state.tab) ? state.tab : "flashcards";
    if (tab === "reinforcement" && REINFORCEMENT_SUB_TABS.includes(state.subTab)) {
      currentReinforcementSubTab = state.subTab;
    }
    showTopicWorkspace(topic, tab);
  }

  // Same-language in-page history only (see syncHash's docstring for why
  // language switches don't push) — reacts to the browser's own
  // back/forward, so it must not itself push/replace any history entry.
  window.addEventListener("popstate", () => applyHashState(parseHash()));

  function renderChaptersList() {
    currentChapter = null;
    currentTopic = null;
    renderBreadcrumb();

    topicsListEl.style.display = "none";
    topicWorkspaceEl.style.display = "none";
    chaptersListEl.innerHTML = "";

    if (CHAPTERS.length === 0) {
      chaptersListEl.style.display = "none";
      textsEmptyStateEl.style.display = "block";
      return;
    }
    textsEmptyStateEl.style.display = "none";
    chaptersListEl.style.display = "flex";

    for (const chapter of CHAPTERS) {
      chaptersListEl.appendChild(
        itemCard(chapter.number, chapter.title, chapter.description, chapter.status, () => {
          showTopics(chapter);
          syncHash(true);
        })
      );
    }
  }

  function showTopics(chapter) {
    currentChapter = chapter;
    currentTopic = null;
    renderBreadcrumb();

    chaptersListEl.style.display = "none";
    topicWorkspaceEl.style.display = "none";
    textsEmptyStateEl.style.display = "none";
    topicsListEl.innerHTML = "";
    topicsListEl.style.display = "flex";

    for (const topic of chapter.topics) {
      topicsListEl.appendChild(
        itemCard(topic.number, topic.title, topic.description, topic.status, () => {
          showTopicWorkspace(topic);
          syncHash(true);
        })
      );
    }
  }

  async function loadReinforcementWords(chapterNumber, topicNumber) {
    try {
      REINFORCEMENT = await getReinforcementWords(LANG, chapterNumber, topicNumber);
    } catch (err) {
      // Reinforcement is a spaced-review enhancement, not core content —
      // a failed fetch shouldn't block the topic itself from opening.
      console.error("Couldn't load reinforcement words", err);
      REINFORCEMENT = {};
    }
  }

  async function showTopicWorkspace(topic, tab = "flashcards") {
    currentTopic = topic;
    renderBreadcrumb();

    chaptersListEl.style.display = "none";
    topicsListEl.style.display = "none";
    topicWorkspaceEl.style.display = "flex";

    watchUpdateBanner();
    await loadReinforcementWords(currentChapter.number, topic.number);
    switchTopicTab(tab);
  }

  async function init() {
    try {
      setUserEmail(getUserEmail());

      const languages = await loadLanguages();
      langSelectEl.innerHTML = "";
      for (const lang of languages) {
        const opt = document.createElement("option");
        opt.value = lang;
        opt.textContent = formatLanguagePairLabel(lang);
        langSelectEl.appendChild(opt);
      }
      // A hash naming a language this catalog actually has wins over the
      // default — this is what makes a shared link ("here's this Spanish
      // topic") open the right content regardless of whichever language
      // the recipient last had selected.
      const hashState = parseHash();
      LANG = (hashState && languages.includes(hashState.lang))
        ? hashState.lang
        : (languages.includes(LANG) ? LANG : (languages[0] || LANG));
      langSelectEl.value = LANG;
      setDataLang();
      populateLangChoiceSelects();

      await loadAndRenderChapters(hashState && hashState.lang === LANG ? hashState : null);
      syncHash(false); // normalizes the URL (no hash, or a hash that didn't fully resolve)
    } catch (err) {
      showTextsError(err);
    }
  }

  init();
})
</script>

<style>
/* Vite mounts this component's template into <div id="app">, which
   didn't exist in plain viewer.html — the sections below used to be
   direct children of <body>, which is what "body { display: flex; ... }"
   right below targets. display:contents makes #app transparent for
   layout purposes so that flex layout still applies unchanged. */
#app {
  display: contents;
}

  :root {
    --bg: #111318;
    --card: #1a1d24;
    --text: #eef0f3;
    --muted: #8b91a0;
    --confident: #35c07a;
    --learning: #e0a530;
    --border: #2a2e38;

    /* raw per-target-language accent trio — theme-owned; which one is
       active is a separate, independent concern (see the data-lang block
       below), so this and a future manual dark/light toggle never redefine
       the same property. */
    --accent-en: #4f8cff;    --accent-en-soft: #1b2a47;  --accent-en-strong: #3f74e0;
    --accent-es: #ff8b5e;    --accent-es-soft: #3a2418;  --accent-es-strong: #ff7038;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f5f6f8;
      --card: #ffffff;
      --text: #1a1d24;
      --muted: #666d7a;
      --confident: #1f9a5a;
      --learning: #b8790a;
      --border: #e1e3e8;

      --accent-en: #2f6fe4;    --accent-en-soft: #e7efff;  --accent-en-strong: #1f56c4;
      --accent-es: #dd5a28;    --accent-es-soft: #fce8dd;  --accent-es-strong: #b8461c;
    }
  }

  /* which target language's accent trio is active right now — kept to just
     these three tokens so the toggle stays independent of the theme blocks
     above. Set via data-lang on <html>, updated in JS whenever LANG changes
     (see setDataLang in the script below). Defaults to English so the app
     still renders correctly before init() resolves the real language. */
  :root, :root[data-lang="en"] {
    --accent: var(--accent-en);
    --accent-soft: var(--accent-en-soft);
    --accent-strong: var(--accent-en-strong);
  }
  :root[data-lang="es"] {
    --accent: var(--accent-es);
    --accent-soft: var(--accent-es-soft);
    --accent-strong: var(--accent-es-strong);
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; height: 100%;
    background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  body {
    display: flex; flex-direction: column; align-items: center;
    gap: 24px;
    min-height: 100vh; padding: 24px;
  }
  .layout {
    display: flex; flex-direction: column;
    gap: 24px;
    width: 100%; max-width: 900px; padding-bottom: 32px;
  }
  @media (min-width: 960px) {
    .layout { flex-direction: row; align-items: flex-start; }
  }
  .sidebar {
    width: 100%;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px;
    display: flex; flex-direction: column; gap: 14px;
  }
  @media (min-width: 960px) {
    .sidebar { width: 220px; flex-shrink: 0; position: sticky; top: 24px; }
  }
  .sidebar-title {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--muted);
  }
  .checkbox-row {
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; cursor: pointer; user-select: none;
  }
  #lang-select, #sentence-lang-select, #cue-lang-select {
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 8px; font-size: 14px;
  }
  #lang-select {
    margin-top: -6px;
  }
  .lang-choice-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; color: var(--muted);
  }
  .gender-style-toggle {
    cursor: pointer;
  }
  .gender-style-toggle input[type="checkbox"] {
    width: 15px; height: 15px; accent-color: var(--accent); cursor: pointer;
  }
  .current-user {
    font-size: 13px; color: var(--text);
    word-break: break-all;
    margin-top: -6px;
  }
  .switch-user-btn {
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 10px; font-size: 13px; cursor: pointer;
  }
  .switch-user-btn:hover {
    border-color: var(--accent); color: var(--accent);
  }
  .checkbox-row input[type="checkbox"] {
    width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer;
  }
  .hidden-words-hint {
    font-size: 12px; color: var(--muted); margin-top: -8px;
  }
  .hidden-words-list {
    display: flex; flex-wrap: wrap; gap: 6px;
  }
  .hidden-words-empty {
    font-size: 13px; color: var(--muted); font-style: italic;
  }
  .hidden-word-chip {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text);
  }
  .hidden-word-chip:hover {
    border-color: var(--accent); color: var(--accent);
  }
  .main {
    display: flex; flex-direction: column; align-items: center;
    gap: 18px;
    flex: 1; width: 100%; min-width: 0;
  }
  .empty-state {
    display: none;
    width: min(90vw, 640px);
    color: var(--muted); font-size: 14px; text-align: center;
    padding: 60px 20px;
    border: 1px dashed var(--border);
    border-radius: 16px;
  }
  .loading {
    display: none;
    width: min(90vw, 640px);
    flex-direction: column; align-items: center; justify-content: center;
    gap: 14px;
    padding: 60px 20px;
    color: var(--muted); font-size: 14px;
  }
  .spinner {
    width: 30px; height: 30px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .topbar {
    display: flex; align-items: center; gap: 12px;
    color: var(--muted); font-size: 14px;
  }
  .badge {
    padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .badge.confident { background: color-mix(in srgb, var(--confident) 20%, transparent); color: var(--confident); }
  .badge.learning { background: color-mix(in srgb, var(--learning) 20%, transparent); color: var(--learning); }

  .card-viewport {
    width: min(90vw, 640px);
    overflow-x: hidden;
  }
  .card-track {
    display: flex;
    touch-action: pan-y;
    cursor: grab;
    will-change: transform;
  }
  .card-track.dragging {
    cursor: grabbing;
    user-select: none;
  }
  .card {
    flex: 0 0 min(90vw, 640px);
    width: min(90vw, 640px);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
    display: flex; flex-direction: column;
    margin: 0px 20px 0px -10px;
  }
  .sentence-area {
    padding: 18px 24px;
    text-align: center;
    border-bottom: 1px solid var(--border);
  }
  .sentence-label {
    font-size: 12px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted);
  }
  .sentence {
    font-size: 16px; color: var(--text); line-height: 1.4; font-style: italic;
  }
  .image-wrap {
    width: 100%; aspect-ratio: 4 / 3;
    background: repeating-conic-gradient(var(--border) 0% 25%, transparent 0% 50%) 50% / 20px 20px;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .image-wrap img {
    max-width: 100%; max-height: 100%; object-fit: contain;
    display: block;
  }
  .missing {
    flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; width: 100%; height: 100%;
    color: var(--muted); font-size: 14px; text-align: center; padding: 24px;
    background: color-mix(in srgb, var(--bg) 90%, transparent);
  }
  .missing-cue-label, .missing-sentence-label {
    display: none;
    font-size: 2px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px;
  }
  .missing-cue {
    font-size: 18px; color: var(--text); line-height: 1.4;
    margin-bottom: 32px;
  }
  .missing-sentence {
    font-size: 24px; color: var(--text); line-height: 1.4;
  }
  .cue-area {
    padding: 18px 24px 0;
    text-align: center;
    border-top: 1px solid var(--border);
  }
  .cue-label {
    font-size: 12px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px;
  }
  .cue {
    font-size: 15px; color: var(--text); line-height: 1.4;
  }
  .word-area {
    padding: 20px 24px 24px;
    text-align: center;
  }
  .label-row {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    margin-bottom: 6px;
  }
  .response-label {
    font-size: 12px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted);
  }
  .speak-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; padding: 0;
    background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); font-size: 23px; cursor: pointer;
  }
  .speak-btn:hover {
    border-color: var(--accent); color: var(--accent);
  }
  .speak-btn:disabled {
    opacity: 0.4; cursor: not-allowed;
  }
  .word {
    font-size: 28px; font-weight: 700;
    min-height: 38px;
    cursor: pointer;
    user-select: none;
  }
  .word.hidden-word {
    filter: blur(10px);
    opacity: 0.5;
  }
  .hint {
    margin-top: 10px; font-size: 13px; color: var(--muted);
  }
  .controls {
    display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 16px;
    color: var(--muted); font-size: 13px;
    /* Hidden purely via CSS — Flashcards.vue still toggles this element's
       inline display style (none/flex) as words/filters change, so
       !important is needed here to keep it hidden regardless of that,
       without touching the component's markup or script. */
    display: none !important;
  }
  kbd {
    background: var(--card); border: 1px solid var(--border);
    border-bottom-width: 2px; border-radius: 6px;
    padding: 2px 7px; font-size: 12px; font-family: inherit; color: var(--text);
  }
  .action-bar {
    width: min(90vw, 640px);
    display: flex; align-items: stretch; gap: 10px;
    /* Hidden purely via CSS — same reasoning as .controls above: Flashcards.vue
       still toggles this element's inline display style, so !important keeps
       it hidden without any script/markup change. */
    display: none !important;
  }
  .action-btn {
    flex: 1;
    min-height: 48px;
    background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 12px;
    font-size: 15px; font-weight: 600;
    cursor: pointer;
  }
  .action-btn:hover {
    border-color: var(--accent); color: var(--accent);
  }
  .action-btn-icon {
    flex: 0 0 56px;
    font-size: 18px;
  }
  .action-btn-primary {
    background: var(--accent); color: #fff; border-color: var(--accent);
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .action-btn-primary:hover {
    background: var(--accent-strong); border-color: var(--accent-strong); color: #fff;
  }
  .progress {
    width: min(90vw, 640px); height: 4px; background: var(--border);
    border-radius: 2px; overflow: hidden;
  }
  .progress-fill {
    height: 100%; background: var(--accent); width: 0%;
    transition: width 0.15s ease;
  }
  .error-banner {
    display: none;
    width: min(90vw, 640px);
    background: color-mix(in srgb, #e0453a 15%, transparent);
    border: 1px solid #e0453a;
    color: #e0453a;
    border-radius: 10px;
    padding: 14px 18px;
    font-size: 13px;
    line-height: 1.5;
  }
  .error-banner code {
    background: rgba(0,0,0,0.15);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .global-topbar {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
    width: 100%; max-width: 900px;
  }
  .global-topbar-user {
    display: flex; align-items: center; gap: 10px;
    flex-wrap: wrap;
  }
  .topbar-user-email {
    font-size: 13px; color: var(--text);
    word-break: break-all;
  }
  #topic-flashcards-panel, #topic-texts-panel {
    display: flex; justify-content: center;
    width: 100%;
  }
  .tabs {
    display: flex; gap: 8px;
    width: 100%; max-width: 900px;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }
  .tab-btn {
    background: transparent; color: var(--muted);
    border: none; border-bottom: 2px solid transparent;
    padding: 8px 4px; font-size: 15px; font-weight: 600;
    cursor: pointer;
    flex: none; white-space: nowrap;
  }
  .tab-btn:hover {
    color: var(--text);
  }
  .tab-btn.active {
    color: var(--text); border-bottom-color: var(--accent);
  }

  .texts-page {
    display: flex; flex-direction: column; align-items: center;
    gap: 18px;
    width: 100%; max-width: 900px;
  }
  #topic-workspace {
    display: flex; flex-direction: column; align-items: center;
    gap: 18px;
    width: 100%;
    padding-bottom: 60px;
  }
  .breadcrumb {
    width: 100%;
    font-size: 13px; color: var(--muted);
  }
  .breadcrumb button {
    background: none; border: none; padding: 0;
    color: var(--muted); font-size: 13px; cursor: pointer;
    text-decoration: underline;
  }
  .breadcrumb button:hover {
    color: var(--accent);
  }
  .breadcrumb .sep {
    margin: 0 6px;
  }
  .breadcrumb .current {
    color: var(--text);
  }
  .item-list {
    display: flex; flex-direction: column; gap: 12px;
    width: 100%;
  }
  .item-card {
    display: flex; align-items: flex-start; gap: 14px; width: 100%; text-align: left;
    background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 16px;
    padding: 15px 18px;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .item-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -14px var(--accent);
  }
  .item-card:active {
    transform: translateY(0);
  }
  .item-card:disabled {
    opacity: 0.6; cursor: not-allowed;
  }
  .item-card:disabled:hover {
    border-color: var(--border); transform: none; box-shadow: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .item-card { transition: border-color 0.15s ease; }
    .item-card:hover { transform: none; }
  }
  .item-card-chip {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums;
    background: var(--accent-soft); color: var(--accent-strong);
  }
  .item-card:disabled .item-card-chip {
    background: var(--border); color: var(--muted);
  }
  .item-card-body {
    display: flex; flex-direction: column; gap: 2px; min-width: 0;
  }
  .item-card-arrow {
    flex-shrink: 0; align-self: center; margin-left: auto;
    color: var(--accent); font-size: 17px; opacity: 0; transform: translateX(-4px);
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
  .item-card:hover .item-card-arrow {
    opacity: 1; transform: translateX(0);
  }
  .item-card:disabled .item-card-arrow {
    display: none;
  }
  .item-card-title {
    font-size: 16px; font-weight: 700;
  }
  .item-card-description {
    font-size: 13px; color: var(--muted); line-height: 1.4;
  }
  .texts-list {
    width: 100%;
    display: flex; flex-direction: column; gap: 12px;
  }
  .text-accordion-item {
    width: 100%;
    background: var(--card);
    border: 1px solid var(--border); border-radius: 16px;
    overflow: hidden;
  }
  .text-accordion-header {
    width: 100%;
    display: flex; align-items: center; gap: 14px;
    padding: 16px 20px;
    background: none; border: none; text-align: left;
    font: inherit; color: var(--text);
    cursor: pointer;
  }
  .text-accordion-header:hover {
    color: var(--accent);
  }
  .text-accordion-number {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
    background: var(--accent-soft); color: var(--accent-strong);
  }
  .text-accordion-title {
    flex: 1; font-size: 16px; font-weight: 700;
  }
  .text-accordion-chevron {
    flex-shrink: 0; color: var(--muted); font-size: 13px;
    transition: transform 0.2s ease;
  }
  .text-accordion-item.expanded .text-accordion-chevron {
    transform: rotate(180deg); color: var(--accent);
  }
  .text-accordion-body {
    padding: 0 20px 20px;
    font-size: 17px; line-height: 1.8; color: var(--text);
  }
  .text-accordion-body p {
    margin: 0 0 14px;
  }
  .text-accordion-body p:last-child {
    margin-bottom: 0;
  }
  .text-accordion-body strong {
    color: var(--accent);
  }

  .sentences-list {
    width: 100%;
    display: flex; flex-direction: column; gap: 12px;
  }
  .sentence-item {
    width: 100%;
    display: flex; align-items: flex-start; gap: 14px;
    padding: 16px 20px;
    background: var(--card);
    border: 1px solid var(--border); border-radius: 16px;
    font-size: 17px; line-height: 1.6; color: var(--text);
  }
  .sentence-item-number {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
    background: var(--accent-soft); color: var(--accent-strong);
  }
  .sentence-item-content strong {
    color: var(--accent);
  }

  .reading-stage {
    width: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 20px;
    min-height: 50vh;
  }
  .reading-counter {
    font-size: 14px; color: var(--muted); font-variant-numeric: tabular-nums;
  }
  .reading-word-area {
    display: flex; align-items: center; justify-content: center;
    width: min(90vw, 640px);
    min-height: 220px;
    padding: 40px;
    background: var(--card);
    border: 1px solid var(--border); border-radius: 24px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .reading-word-area:hover {
    border-color: var(--accent);
  }
  .reading-word {
    font-size: clamp(32px, 8vw, 64px); font-weight: 800;
    text-align: center; word-break: break-word;
    color: var(--text);
  }
  .reading-hint {
    font-size: 13px; color: var(--muted);
  }

  /* Typing tab — this stage stays a dark canvas regardless of the app's
     light/dark theme (literal colors below, not var(--bg)/var(--card)):
     the mechanic itself is white-on-black letter opacity, so it doesn't
     adapt. Completed words still use var(--accent) — the app's existing
     per-language accent (see the :root[data-lang] rules) — so a finished
     word reads as "this language's color" in either theme. */
  #topic-typing-panel {
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: 100%;
  }
  .typing-stage {
    position: relative;
    width: 100%;
    min-height: 50vh;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid #2a2e38;
    background:
      radial-gradient(ellipse at 50% -10%, rgba(255, 255, 255, 0.05), transparent 55%),
      repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.012) 0px, rgba(255, 255, 255, 0.012) 1px, transparent 1px, transparent 3px),
      linear-gradient(180deg, #0d1016, #0a0c10);
  }
  .typing-danger-zone {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(11%, 110px);
    background: linear-gradient(90deg, rgba(255, 92, 108, 0.16), transparent);
    border-right: 1px dashed rgba(255, 92, 108, 0.35);
  }
  .typing-hud {
    position: absolute;
    top: 12px; right: 16px;
    display: flex; gap: 14px;
    font-size: 12px; color: #8b91a0;
    font-variant-numeric: tabular-nums;
    z-index: 2;
  }
  .typing-hud b {
    color: #eef0f3;
  }
  .typing-hud-missed b {
    color: #ff5c6c;
  }
  .typing-lanes {
    position: absolute;
    inset: 0;
  }
  .typing-lane-guide {
    position: absolute;
    left: 0; right: 0; height: 1px;
    background-image: linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 6px, transparent 6px 14px);
    background-size: 14px 1px;
  }
  .typing-flyers {
    position: absolute;
    inset: 0;
  }
  .typing-flyer {
    position: absolute;
    top: 0; left: 0;
    display: flex;
    font-family: ui-monospace, "SFMono-Regular", "Cascadia Code", "Roboto Mono", Consolas, monospace;
    font-weight: 700;
    font-size: clamp(18px, 2.4vw, 28px);
    letter-spacing: 0.04em;
    white-space: nowrap;
    will-change: transform;
    filter: drop-shadow(0 1px 10px rgba(0, 0, 0, 0.5));
  }
  .typing-letter {
    display: inline-block;
    /* Preserves a lone space character's width instead of it collapsing
       away under normal whitespace rules — multi-word target vocabulary
       (e.g. "de nada") would otherwise render as "denada". */
    white-space: pre;
    color: rgba(255, 255, 255, 0.6);
    transition: color 0.12s ease, transform 0.12s ease;
  }
  .typing-letter.typed {
    color: #ffffff;
  }
  .typing-letter.pop {
    transform: translateY(-4px) scale(1.08);
  }
  .typing-flyer.done .typing-letter {
    color: var(--accent);
  }
  .typing-flyer.done {
    animation: typing-done-pop 0.42s ease forwards;
  }
  .typing-flyer.missed .typing-letter {
    color: #ff5c6c;
    transition: color 0.25s ease, opacity 0.5s ease 0.1s;
  }
  .typing-flyer.missed {
    animation: typing-missed-fall 0.5s ease forwards;
  }
  @keyframes typing-done-pop {
    0% { transform: scale(1); }
    45% { transform: scale(1.16); }
    100% { transform: translateY(-22px) scale(1); opacity: 0; }
  }
  @keyframes typing-missed-fall {
    0% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(10px); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .typing-flyer.done { animation: none; }
    .typing-flyer.missed { animation: none; }
    .typing-letter.pop { transform: none; }
  }
  .typing-controls {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
  }
  .typing-hint {
    font-size: 13px; color: var(--muted);
  }
  .typing-controls-actions {
    display: flex; align-items: center; gap: 12px;
    flex-shrink: 0;
  }
  .typing-speed-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; color: var(--muted);
  }
  #typing-speed-select {
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 8px; font-size: 13px;
  }
  .typing-reset-btn {
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 10px; font-size: 13px; cursor: pointer;
  }
  .typing-reset-btn:hover {
    border-color: var(--accent); color: var(--accent);
  }
  .typing-key-capture {
    position: absolute;
    width: 1px; height: 1px;
    margin: -1px; padding: 0; border: 0;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }

  /* Dictation tab — listen to a word, type it, check per-letter accuracy.
     .dictation-letter.correct uses var(--accent), the same per-target-
     language color used everywhere else in the app. */
  #topic-dictation-panel {
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
    position: relative;
  }
  .dictation-stage {
    width: 100%;
    max-width: min(90vw, 360px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 20px;
    min-height: 50vh;
  }
  .dictation-counter {
    font-size: 14px; color: var(--muted); font-variant-numeric: tabular-nums;
  }
  .dictation-reveal-area {
    display: flex; align-items: center; justify-content: center;
    min-height: 100px;
  }
  .dictation-audio-btn {
    display: flex; align-items: center; justify-content: center;
    width: 96px; height: 96px;
    border-radius: 50%;
    background: var(--accent); color: #fff;
    border: none;
    font-size: 40px;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    transition: transform 0.1s ease, background 0.15s ease;
  }
  .dictation-audio-btn:hover {
    background: var(--accent-strong);
  }
  .dictation-audio-btn:active {
    transform: scale(0.96);
  }
  .dictation-result-word {
    display: none;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    gap: 1px;
    font-size: 28px; font-weight: 700;
    min-height: 96px;
  }
  .dictation-letter-correct, .dictation-letter-missing, .dictation-letter-wrong {
    display: inline-block;
    white-space: pre;
  }
  .dictation-letter-correct {
    color: var(--accent);
  }
  .dictation-letter-missing {
    color: var(--muted);
    opacity: 0.5;
  }
  .dictation-letter-wrong {
    color: #e0453a;
    font-size: 0.7em;
  }
  .dictation-input {
    width: min(90vw, 360px);
    background: transparent;
    color: var(--text);
    border: none;
    border-bottom: 2px solid var(--border);
    text-align: center;
    font-size: 28px; font-weight: 700; font-family: inherit;
    padding: 6px 4px;
  }
  .dictation-input:focus {
    outline: none;
    border-bottom-color: var(--accent);
  }
  .dictation-hint {
    font-size: 13px; color: var(--muted);
  }
  .dictation-check-btn {
    display: none;
    align-self: flex-end;
    align-items: center; justify-content: center;
    width: 56px; height: 56px;
    border-radius: 50%;
    background: var(--accent); color: #fff;
    border: none;
    font-size: 22px; font-weight: 700;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }
  .dictation-check-btn:hover {
    filter: brightness(1.1);
  }
  .dictation-check-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Quiz tab — picture (or cue fallback, reusing Flashcards' .image-wrap/
     .missing) with four word options in a 2x2 grid. .quiz-option-correct
     reuses the per-target-language accent trio; .quiz-option-wrong/-reveal
     are a fixed red/green pair since they signal right-vs-wrong, not
     language identity. */
  #topic-quiz-panel {
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
  }
  .quiz-stage {
    width: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 20px;
    min-height: 50vh;
  }
  .quiz-counter {
    font-size: 14px; color: var(--muted); font-variant-numeric: tabular-nums;
  }
  .quiz-image-wrap {
    width: min(90vw, 420px);
    border-radius: 16px;
    border: 1px solid var(--border);
  }
  .quiz-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    width: min(90vw, 420px);
  }
  .quiz-option {
    aspect-ratio: 1 / 1;
    display: flex; align-items: center; justify-content: center;
    padding: 12px;
    border-radius: 14px;
    border: 2px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 18px; font-weight: 600;
    text-align: center;
    cursor: pointer;
    transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
  }
  .quiz-option:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .quiz-option:disabled {
    cursor: not-allowed;
  }
  .quiz-option-correct {
    border-color: var(--accent-strong);
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  .quiz-option-wrong {
    border-color: #e0453a;
    background: color-mix(in srgb, #e0453a 15%, transparent);
    color: #e0453a;
  }
  .quiz-option-reveal {
    border-color: var(--confident);
    background: color-mix(in srgb, var(--confident) 20%, transparent);
    color: var(--confident);
  }

  /* Small 💪 corner marker for a reinforcement word (carried over from an
     earlier topic, per reinforcement_words_by_tab) — shared across
     Reading/Dictation/Quiz/Phrases, wherever that tab shows the word. */
  .reinforcement-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    background: var(--card);
    border: 1px solid var(--border);
    font-size: 12px;
    line-height: 1;
  }
  .reading-word-area, .quiz-option, .phrase-option {
    position: relative;
  }
  #reading-reinforcement-badge, #dictation-reinforcement-badge {
    position: static;
    margin-bottom: 6px;
  }

  /* Phrases tab — listen to a natural sentence, tap its known words in
     order from an 8-option bank. Shares Dictation's audio-button look and
     Quiz's option color/border language (correct/wrong), generalized to a
     variable-length option list instead of a fixed 2x2 grid. */
  #topic-phrases-panel {
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 100%;
  }
  .phrases-stage {
    width: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 20px;
    min-height: 50vh;
  }
  .phrases-counter {
    font-size: 14px; color: var(--muted); font-variant-numeric: tabular-nums;
  }
  .phrase-audio-area {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    width: min(90vw, 420px);
    min-height: 96px;
  }
  .phrase-audio-btn {
    display: flex; align-items: center; justify-content: center;
    width: 96px; height: 96px;
    border-radius: 50%;
    background: var(--accent); color: #fff;
    border: none;
    font-size: 40px;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    transition: transform 0.1s ease, background 0.15s ease;
  }
  .phrase-audio-btn:hover { background: var(--accent-strong); }
  .phrase-audio-btn:active { transform: scale(0.96); }
  .phrase-sentence-display {
    padding: 20px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--card);
    font-size: 18px;
    line-height: 1.5;
    text-align: center;
  }
  .phrase-blank {
    display: inline-block;
    min-width: 2.5em;
    border-bottom: 2px solid var(--muted);
    color: transparent;
  }
  .phrase-toggle-btn {
    position: absolute;
    right: 0; bottom: -8px;
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 16px;
    cursor: pointer;
  }
  .phrase-toggle-btn:hover { border-color: var(--accent); }
  .phrase-options {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    width: min(90vw, 560px);
  }
  .phrase-option {
    display: flex; align-items: center; justify-content: center;
    padding: 10px 18px;
    border-radius: 999px;
    border: 2px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 16px; font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s ease, opacity 0.15s ease, border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
  }
  .phrase-option:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .phrase-option.dimmed {
    opacity: 0.5;
  }
  .phrase-option-correct {
    border-color: var(--accent-strong);
    background: var(--accent-soft);
    color: var(--accent-strong);
    opacity: 1;
  }
  .phrase-option-wrong {
    border-color: #e0453a;
    background: color-mix(in srgb, #e0453a 15%, transparent);
    color: #e0453a;
    opacity: 1;
  }
  .phrase-option-order-badge {
    position: absolute;
    top: -8px;
    left: -8px;
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    background: var(--accent-strong);
    color: #fff;
    font-size: 12px; font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .phrase-proceed-btn {
    padding: 10px 24px;
    border-radius: 999px;
    border: none;
    background: var(--accent);
    color: #fff;
    font-size: 15px; font-weight: 600;
    cursor: pointer;
  }
  .phrase-proceed-btn:hover { background: var(--accent-strong); }

  .exercise-list {
    display: flex; flex-direction: column; gap: 14px;
    width: 100%; padding-bottom: 32px;
  }
  .exercise-title {
    margin: 8px 0 0;
    font-size: 15px; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .exercise-item {
    display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
    background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px;
    font-size: 15px; line-height: 1.8;
  }
  .exercise-number {
    font-weight: 700; color: var(--muted);
  }
  .exercise-input {
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 10px; font-size: 15px; width: 140px;
  }
  .exercise-input:focus {
    outline: none; border-color: var(--accent);
  }
  .exercise-subtitle {
    font-size: 13px; color: var(--muted);
    margin-bottom: 4px;
  }
  .exercise-word-bank {
    display: flex; flex-wrap: wrap; gap: 10px;
    background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px; margin-bottom: 10px;
  }
  .exercise-classify .exercise-item {
    margin-top: 10px;
  }
  .exercise-category-title {
    font-weight: 600; min-width: 180px;
  }
  .exercise-category-input, .exercise-open-input {
    flex: 1; min-width: 180px; width: auto;
  }
  .exercise-open-response {
    display: flex; flex-direction: column; gap: 10px;
  }
  .exercise-item-group {
    display: flex; flex-direction: column; gap: 8px;
  }
  .exercise-guided-list, .exercise-open-ended, .exercise-dialogue-comprehension {
    display: flex; flex-direction: column; gap: 16px;
  }
  .exercise-situation, .exercise-context {
    font-size: 14px; color: var(--muted); font-style: italic;
    padding: 0 2px;
  }
  .exercise-context strong {
    color: var(--accent); font-style: normal;
  }
  .exercise-prompt {
    display: flex; flex-wrap: wrap;
  }
  .exercise-open-ended-input {
    flex: 1; min-width: 180px; width: auto;
  }
  .exercise-question-row {
    margin-top: 4px;
  }
  .exercise-cue-wrap {
    position: relative;
    display: inline-flex; align-items: center;
  }
  .exercise-cue-image {
    width: 40px; height: 40px; object-fit: contain;
    border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg);
    cursor: zoom-in;
  }
  .cue-btn {
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 10px; font-size: 13px; cursor: pointer;
  }
  .cue-btn:hover {
    border-color: var(--accent); color: var(--accent);
  }
  .cue-balloon {
    display: none;
    position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
    margin-bottom: 8px;
    background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 12px; font-size: 13px; line-height: 1.4;
    width: max-content; max-width: 220px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.25);
    z-index: 10;
  }
  .cue-balloon.visible {
    display: block;
  }

  .image-lightbox {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.85);
    align-items: center; justify-content: center;
    padding: 24px;
    cursor: zoom-out;
    z-index: 100;
  }
  .image-lightbox.visible {
    display: flex;
  }
  .image-lightbox img {
    max-width: min(90vw, 480px); max-height: 90vh;
    object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
</style>
