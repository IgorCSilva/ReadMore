<template>

  <Notifications />

  <div class="global-topbar" id="global-topbar">
    <div class="global-topbar-user">
      <span class="topbar-user-email" id="current-user-email"></span>
      <button type="button" class="switch-user-btn" id="switch-user-btn">Log in with another email</button>
    </div>
    <select id="lang-select"></select>
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
        <button type="button" class="tab-btn" id="topic-tab-texts" data-tab="texts">Texts</button>
        <button type="button" class="tab-btn" id="topic-tab-exercises" data-tab="exercises">Exercises</button>
      </div>

      <Flashcards ref="flashcardsRef" />

      <Texts ref="textsRef" />

      <Exercises ref="exercisesRef" />
    </div>
  </div>

</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getChapters, getLanguages } from './shared/api'
import { cacheKey, writeCache } from './shared/cache'
import { readStale, refreshInBackground } from './shared/dataSync'
import { formatLanguagePairLabel } from './shared/languages'
import { escapeHtml } from './shared/text'
import { flushQueuedWrites } from './shared/writeQueue'
import Flashcards from './features/catalog/Flashcards.vue'
import Notifications from './shared/Notifications.vue'
import Texts from './features/texts/Texts.vue'
import Exercises from './features/exercises/Exercises.vue'

// Template refs to the tab children — declared at top level (not inside
// onMounted) since Vue only binds template refs (ref="..." in the template
// above) to variables visible at setup() scope.
const flashcardsRef = ref(null)
const textsRef = ref(null)
const exercisesRef = ref(null)

// Lifted from viewer.html's end-of-body <script> unchanged (Step 2.1 of
// RESTRUCTURE_PLAN.md Phase 2 — behavior-preserving re-platform, not a
// rewrite). Wrapped in onMounted() since Vue mounts the template
// asynchronously, unlike a plain end-of-body script that ran once the
// browser had already parsed the DOM synchronously above it — onMounted
// fires at the equivalent point once Vue's own DOM is in place.
onMounted(() => {

  const EMAIL_STORAGE_KEY = "readmore_user_email";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let USER_EMAIL = null;
  let LANG = "english";

  const langSelectEl = document.getElementById("lang-select");
  const currentUserEmailEl = document.getElementById("current-user-email");
  const switchUserBtn = document.getElementById("switch-user-btn");

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

  langSelectEl.addEventListener("change", () => {
    LANG = langSelectEl.value;
    loadAndRenderChapters();
  });

  // ---- Topic workspace tabs (Flashcards / Texts within a topic) ----

  let currentTopicTab = "flashcards";
  const topicWorkspaceEl = document.getElementById("topic-workspace");
  const topicTabFlashcardsBtn = document.getElementById("topic-tab-flashcards");
  const topicTabTextsBtn = document.getElementById("topic-tab-texts");
  const topicTabExercisesBtn = document.getElementById("topic-tab-exercises");
  const topicFlashcardsPanelEl = document.getElementById("topic-flashcards-panel");
  const topicTextsPanelEl = document.getElementById("topic-texts-panel");
  const topicExercisesPanelEl = document.getElementById("topic-exercises-panel");

  function switchTopicTab(tab) {
    currentTopicTab = tab;
    topicTabFlashcardsBtn.classList.toggle("active", tab === "flashcards");
    topicTabTextsBtn.classList.toggle("active", tab === "texts");
    topicTabExercisesBtn.classList.toggle("active", tab === "exercises");
    topicFlashcardsPanelEl.style.display = tab === "flashcards" ? "flex" : "none";
    topicTextsPanelEl.style.display = tab === "texts" ? "flex" : "none";
    topicExercisesPanelEl.style.display = tab === "exercises" ? "flex" : "none";
    if (tab === "flashcards") {
      flashcardsRef.value?.load(USER_EMAIL, LANG, currentTopic);
    } else if (tab === "texts") {
      textsRef.value?.show(currentTopic);
    } else {
      exercisesRef.value?.show(LANG, currentTopic);
    }
  }

  topicTabFlashcardsBtn.addEventListener("click", () => switchTopicTab("flashcards"));
  topicTabTextsBtn.addEventListener("click", () => switchTopicTab("texts"));
  topicTabExercisesBtn.addEventListener("click", () => switchTopicTab("exercises"));

  // ---- Texts ----

  let CHAPTERS = [];
  let currentChapter = null;
  let currentTopic = null;

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

  async function loadAndRenderChapters() {
    textsErrorBanner.style.display = "none";

    const key = cacheKey("chapters", USER_EMAIL, LANG);
    const cached = readStale(key);
    if (cached) {
      CHAPTERS = cached.data;
      currentChapter = null;
      currentTopic = null;
      renderChaptersList();
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
      renderChaptersList();
    } catch (err) {
      showTextsError(err);
    } finally {
      textsLoadingEl.style.display = "none";
    }
  }

  function renderBreadcrumb() {
    textsBreadcrumbEl.innerHTML = "";

    const chaptersBtn = document.createElement("button");
    chaptersBtn.type = "button";
    chaptersBtn.textContent = "Chapters";
    chaptersBtn.addEventListener("click", renderChaptersList);
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
    chapterBtn.addEventListener("click", () => showTopics(currentChapter));
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
      `<div class="item-card-title">${number}. ${escapeHtml(title)}</div>` +
      (description ? `<div class="item-card-description">${escapeHtml(description)}</div>` : "");
    if (status === "in_development") {
      card.disabled = true;
    } else {
      card.addEventListener("click", onClick);
    }
    return card;
  }

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
        itemCard(chapter.number, chapter.title, chapter.description, chapter.status, () => showTopics(chapter))
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
        itemCard(topic.number, topic.title, topic.description, topic.status, () => showTopicWorkspace(topic))
      );
    }
  }

  function showTopicWorkspace(topic) {
    currentTopic = topic;
    renderBreadcrumb();

    chaptersListEl.style.display = "none";
    topicsListEl.style.display = "none";
    topicWorkspaceEl.style.display = "flex";

    switchTopicTab("flashcards");
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
      LANG = languages.includes(LANG) ? LANG : (languages[0] || LANG);
      langSelectEl.value = LANG;

      await loadAndRenderChapters();
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
    --accent: #4f8cff;
    --confident: #35c07a;
    --learning: #e0a530;
    --border: #2a2e38;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f5f6f8;
      --card: #ffffff;
      --text: #1a1d24;
      --muted: #666d7a;
      --accent: #2f6fe4;
      --confident: #1f9a5a;
      --learning: #b8790a;
      --border: #e1e3e8;
    }
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
  #lang-select {
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 8px; font-size: 14px; margin-top: -6px;
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

  .card {
    width: min(90vw, 640px);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
    display: flex; flex-direction: column;
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
  }
  kbd {
    background: var(--card); border: 1px solid var(--border);
    border-bottom-width: 2px; border-radius: 6px;
    padding: 2px 7px; font-size: 12px; font-family: inherit; color: var(--text);
  }
  .action-bar {
    width: min(90vw, 640px);
    display: flex; align-items: stretch; gap: 10px;
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
  }
  .action-btn-primary:hover {
    opacity: 0.9; color: #fff;
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
  }
  .tab-btn {
    background: transparent; color: var(--muted);
    border: none; border-bottom: 2px solid transparent;
    padding: 8px 4px; font-size: 15px; font-weight: 600;
    cursor: pointer;
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
    display: block; width: 100%; text-align: left;
    background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 14px;
    padding: 16px 18px;
    cursor: pointer;
  }
  .item-card:hover {
    border-color: var(--accent);
  }
  .item-card:disabled {
    opacity: 0.5; cursor: not-allowed;
  }
  .item-card:disabled:hover {
    border-color: var(--border);
  }
  .item-card-title {
    font-size: 16px; font-weight: 700;
  }
  .item-card-description {
    margin-top: 4px;
    font-size: 13px; color: var(--muted); line-height: 1.4;
  }
  .text-reader {
    width: 100%;
    background: var(--card);
    border: 1px solid var(--border); border-radius: 16px;
    padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .text-reader-number {
    font-size: 12px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--muted);
  }
  .text-reader-title {
    margin: 4px 0 0; font-size: 20px;
  }
  .text-reader-body {
    font-size: 17px; line-height: 1.8; color: var(--text);
  }
  .text-reader-body p {
    margin: 0 0 14px;
  }
  .text-reader-body p:last-child {
    margin-bottom: 0;
  }
  .text-reader-body strong {
    color: var(--accent);
  }

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
