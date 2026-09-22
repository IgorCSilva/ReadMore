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

        <div class="card-viewport">
          <div class="card-track" id="card-track">
            <div class="card" v-for="role in CARD_ROLES" :key="role" :data-role="role">
              <div class="sentence-area">
                <div class="label-row">
                  <div class="sentence-label">Sentence</div>
                  <button type="button" class="speak-btn speak-sentence-btn" title="Play sentence" aria-label="Play sentence">🔊</button>
                </div>
                <div class="sentence"></div>
              </div>
              <div class="image-wrap">
                <img class="card-img" alt="">
                <div class="missing">
                  <div>
                    <div class="missing-cue-label">Cue</div>
                    <div class="missing-cue"></div>
                  </div>
                  <div>
                    <div class="label-row">
                      <div class="missing-sentence-label">Sentence</div>
                      <button type="button" class="speak-btn speak-missing-sentence-btn" title="Play sentence" aria-label="Play sentence">🔊</button>
                    </div>
                    <div class="missing-sentence"></div>
                  </div>
                </div>
              </div>
              <div class="cue-area">
                <div class="cue-label">Cue</div>
                <div class="cue"></div>
              </div>
              <div class="word-area">
                <div class="label-row">
                  <div class="response-label">Response</div>
                  <button type="button" class="speak-btn speak-word-btn" title="Play pronunciation" aria-label="Play pronunciation">🔊</button>
                </div>
                <div class="word hidden-word">•••••</div>
                <div class="hint">click word to reveal</div>
              </div>
            </div>
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
import { ttsUrl } from '../../shared/api'
import { formatWordByGender, getGender } from '../../shared/genders'
import { speechLocaleFor } from '../../shared/languages'
import { loadUserWords, patchUserWord } from '../../shared/userWords'
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
//
// ---- Three-slide carousel, not one mutated card ----
//
// An earlier version reused a single card element and rewrote its content
// (including the <img> src) the moment a slide animation reached its
// off-screen midpoint. That raced the image fetch against the slide-back-in
// animation: an <img> keeps painting its previous frame until the new
// resource finishes loading, so an uncached image let the *previous* card's
// picture ride into view before flipping to the correct one partway through
// the animation.
//
// This version keeps three permanent DOM cards (data-role="prev"/"current"/
// "next") in a flex track and only ever slides the track's transform. Each
// slide's content is populated well before it's ever visible: the "next"
// and "prev" slides are already fully loaded, off-screen, while "current"
// is on screen. Advancing just animates the track by one card-width (pure
// CSS, no content changes involved) and then, once that's done and the new
// current slide is already sitting in place, relabels the three slides'
// roles (via each card's inline `order` style, not by moving DOM nodes) and
// republishes content only into whichever slide just became the new
// off-screen prev/next — invisible at that moment, so there's nothing for
// the user to see mutate. See render() and commitSlide() below.

const CARD_ROLES = ["prev", "current", "next"];
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

// Assigned inside onMounted, once DOM refs exist; the wrapper below is what
// defineExpose captures, and it's only ever called by the parent after this
// component (and therefore onMounted) has already run.
let load;

onMounted(() => {
  const panelEl = document.getElementById("topic-flashcards-panel");
  const trackEl = document.getElementById("card-track");
  const cardViewportEl = document.querySelector(".card-viewport");
  const counterEl = document.getElementById("counter");
  const badgeEl = document.getElementById("badge");
  const progressFill = document.getElementById("progress-fill");
  const errorBanner = document.getElementById("error-banner");
  const loadingEl = document.getElementById("loading");
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

  // One persistent slot object per physical card element — these three DOM
  // nodes (and their descendants) are never created/destroyed again; only
  // their content and `role` (which drives their visual left/mid/right
  // position via CSS `order`, see setSlotRole) ever change.
  const slots = Array.from(trackEl.children).map((el) => ({
    el,
    role: el.dataset.role,
    entry: null,
    revealed: false,
    imgEl: el.querySelector(".card-img"),
    missingEl: el.querySelector(".missing"),
    missingCueEl: el.querySelector(".missing-cue"),
    missingSentenceEl: el.querySelector(".missing-sentence"),
    sentenceEl: el.querySelector(".sentence"),
    sentenceAreaEl: el.querySelector(".sentence-area"),
    cueEl: el.querySelector(".cue"),
    cueAreaEl: el.querySelector(".cue-area"),
    wordEl: el.querySelector(".word"),
    speakWordBtn: el.querySelector(".speak-word-btn"),
    speakSentenceBtn: el.querySelector(".speak-sentence-btn"),
    speakMissingSentenceBtn: el.querySelector(".speak-missing-sentence-btn"),
  }));

  function getSlotByRole(role) {
    return slots.find((s) => s.role === role);
  }

  function setSlotRole(slot, role) {
    slot.role = role;
    slot.el.dataset.role = role;
    slot.el.style.order = String(CARD_ROLES.indexOf(role));
  }

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

  // Speak buttons/word-reveal exist on all three slides (so a mid-drag peek
  // at a neighbor still looks like a real card), but only ever act for the
  // slide currently playing the "current" role — the other two are either
  // fully off-screen or, at most, mid-drag peeking in from an edge.
  function toggleReveal(slot) {
    if (slot.role !== "current") return;
    slot.revealed = !slot.revealed;
    slot.wordEl.classList.toggle("hidden-word", !slot.revealed);
  }

  function speakSlotWord(slot) {
    if (slot.role !== "current" || !slot.entry) return;
    speakWord(slot.entry.word, targetLangCode());
  }

  function speakSlotSentence(slot) {
    if (slot.role !== "current" || !slot.entry) return;
    const filledSentence = slot.entry.sentence.replace(/_+/g, slot.entry.word);
    speakWord(filledSentence, SENTENCE_LANG === "origin" ? originLangCode() : targetLangCode());
  }

  for (const slot of slots) {
    slot.wordEl.addEventListener("click", () => toggleReveal(slot));
    slot.speakWordBtn.addEventListener("click", () => speakSlotWord(slot));
    slot.speakSentenceBtn.addEventListener("click", () => speakSlotSentence(slot));
    slot.speakMissingSentenceBtn.addEventListener("click", () => speakSlotSentence(slot));
  }

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
      cardViewportEl.style.display = "none";
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

  // Cache-warming for entries that aren't one of the three live slides yet
  // (see preloadImage calls below) — a detached Image() probe fetches into
  // the browser's own HTTP cache so that, by the time that entry actually
  // reaches a slide's real <img>, the src assignment resolves instantly
  // instead of stalling on the network.
  const preloadedImageUrls = new Set();

  function preloadImage(entry) {
    if (!entry) return;
    const candidates = extCandidates(entry);
    let i = 0;
    function tryNext() {
      if (i >= candidates.length) return;
      const url = `images/${entry.base}.${candidates[i]}`;
      i++;
      if (preloadedImageUrls.has(url)) return;
      const probe = new Image();
      probe.onload = () => preloadedImageUrls.add(url);
      probe.onerror = tryNext;
      probe.src = url;
    }
    tryNext();
  }

  function loadImageForSlot(slot, entry) {
    const candidates = extCandidates(entry);
    let i = 0;

    slot.imgEl.style.display = "block";
    slot.missingEl.style.display = "none";
    slot.sentenceAreaEl.style.display = "block";
    slot.cueAreaEl.style.display = "block";

    function tryNext() {
      if (i >= candidates.length) {
        slot.imgEl.style.display = "none";
        slot.missingEl.style.display = "flex";
        slot.sentenceAreaEl.style.display = "none";
        slot.cueAreaEl.style.display = "none";
        slot.missingCueEl.textContent = entry.cue;
        slot.missingSentenceEl.textContent = entry.sentence;
        return;
      }
      const ext = candidates[i];
      i++;
      slot.imgEl.onerror = tryNext;
      slot.imgEl.src = `images/${entry.base}.${ext}`;
    }
    tryNext();
  }

  function populateSlot(slot, entry) {
    slot.entry = entry;
    slot.revealed = false;
    loadImageForSlot(slot, entry);

    slot.sentenceEl.textContent = entry.sentence;
    slot.cueEl.textContent = entry.cue;

    slot.wordEl.textContent = formatWordByGender(entry.word, entry.genderId);
    slot.wordEl.style.color = getGender(entry.genderId).color || "";
    slot.wordEl.classList.add("hidden-word");
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
      cardViewportEl.style.display = "none";
      progressEl.style.display = "none";
      controlsEl.style.display = "none";
      actionBarEl.style.display = "none";
      emptyStateEl.style.display = "block";
      counterEl.textContent = "0 / 0";
      badgeEl.style.display = "none";
    } else {
      cardViewportEl.style.display = "block";
      progressEl.style.display = "block";
      controlsEl.style.display = "flex";
      actionBarEl.style.display = "flex";
      emptyStateEl.style.display = "none";
      badgeEl.style.display = "inline";
      render();
    }
  }

  function updateChrome() {
    counterEl.textContent = `${index + 1} / ${ENTRIES.length}`;
    badgeEl.textContent = ENTRIES[index].confident ? "confident" : "learning";
    badgeEl.className = "badge " + (ENTRIES[index].confident ? "confident" : "learning");
    progressFill.style.width = `${((index + 1) / ENTRIES.length) * 100}%`;
  }

  // Full rebuild: (re)populates all three slides from scratch against the
  // current index/ENTRIES, for every non-animated transition (initial load,
  // filter changes, know/hide changes, and the "Next"/space-bar advance,
  // which has never animated). Always resets slot roles back to their
  // literal prev/current/next order first, so it recovers cleanly no matter
  // what an interrupted slide animation left behind.
  function render() {
    if (ENTRIES.length === 0) return;

    const prevEntry = ENTRIES[(index - 1 + ENTRIES.length) % ENTRIES.length];
    const currentEntry = ENTRIES[index];
    const nextEntry = ENTRIES[(index + 1) % ENTRIES.length];

    setSlotRole(slots[0], "prev");
    setSlotRole(slots[1], "current");
    setSlotRole(slots[2], "next");

    populateSlot(slots[0], prevEntry);
    populateSlot(slots[1], currentEntry);
    populateSlot(slots[2], nextEntry);

    setTrackTransition(false);
    setTrackOffset(0);

    updateChrome();

    preloadImage(ENTRIES[(index + 2) % ENTRIES.length]);
    preloadImage(ENTRIES[(index - 2 + ENTRIES.length) % ENTRIES.length]);
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

  // ---- Swipe/drag to advance (Pointer Events cover touch + mouse alike) ----

  const SLIDE_MS = 220;
  const SWIPE_MOVE_THRESHOLD = 6; // px of motion before a press counts as a drag, not a click
  const SWIPE_ADVANCE_RATIO = 0.25; // fraction of card width that commits to next/prev

  let drag = null; // { pointerId, startX, currentX, moved }

  function cardWidthPx() {
    return cardViewportEl.getBoundingClientRect().width || 1;
  }

  function setTrackTransition(enabled) {
    trackEl.style.transition = enabled ? `transform ${SLIDE_MS}ms ease` : "none";
  }

  // The track's resting position always shows the "current" (middle) slide
  // — that's the -cardWidthPx() baseline below — offset by however far a
  // drag has moved it so far.
  function setTrackOffset(dx) {
    trackEl.style.transform = `translateX(${-cardWidthPx() + dx}px)`;
  }

  // Relabels the three slides' roles once a slide animation has finished —
  // called with the track already sitting one card-width over, so the slide
  // that's visually arrived in the center is simply renamed "current"
  // rather than having its content replaced. Only the slide rotating into
  // the new off-screen prev/next position (recycled from whichever slide
  // just scrolled fully out of view) gets fresh content, and it does so
  // while invisible — never the one on screen.
  function commitSlide(direction) {
    const prevSlot = getSlotByRole("prev");
    const currentSlot = getSlotByRole("current");
    const nextSlot = getSlotByRole("next");

    if (direction === "left") {
      index = (index + 1) % ENTRIES.length;
      setSlotRole(currentSlot, "prev");
      setSlotRole(nextSlot, "current");
      setSlotRole(prevSlot, "next");
      populateSlot(prevSlot, ENTRIES[(index + 1) % ENTRIES.length]);
      preloadImage(ENTRIES[(index + 2) % ENTRIES.length]);
    } else {
      index = (index - 1 + ENTRIES.length) % ENTRIES.length;
      setSlotRole(prevSlot, "current");
      setSlotRole(currentSlot, "next");
      setSlotRole(nextSlot, "prev");
      populateSlot(nextSlot, ENTRIES[(index - 1 + ENTRIES.length) % ENTRIES.length]);
      preloadImage(ENTRIES[(index - 2 + ENTRIES.length) % ENTRIES.length]);
    }

    setTrackTransition(false);
    setTrackOffset(0);
    void trackEl.offsetWidth; // flush the reset before re-enabling the transition
    setTrackTransition(true);

    updateChrome();
  }

  // Animates the track by one card-width toward `direction`, then commits
  // the role rotation above once it settles — used by the drag gesture
  // below and by the prev/next buttons and arrow keys, so every way of
  // changing cards feels the same.
  function slideAndAdvance(direction) {
    if (ENTRIES.length === 0) return;
    const dx = direction === "left" ? -cardWidthPx() : cardWidthPx();
    setTrackTransition(true);
    setTrackOffset(dx);
    window.setTimeout(() => commitSlide(direction), SLIDE_MS);
  }

  function onCardPointerDown(e) {
    if (ENTRIES.length === 0) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag = { pointerId: e.pointerId, startX: e.clientX, currentX: e.clientX, moved: false };
    // No setPointerCapture here: capturing on every press — even a plain tap
    // on the word or a speak button — makes the browser retarget the
    // resulting click event to the track instead of whatever was actually
    // tapped, silently breaking word-reveal and the speak buttons. Capture
    // is only acquired below once a press has actually turned into a drag.
  }

  function onCardPointerMove(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.currentX = e.clientX;
    const dx = drag.currentX - drag.startX;
    if (!drag.moved && Math.abs(dx) > SWIPE_MOVE_THRESHOLD) {
      drag.moved = true;
      trackEl.classList.add("dragging");
      trackEl.setPointerCapture?.(e.pointerId);
      setTrackTransition(false);
    }
    if (drag.moved) setTrackOffset(dx);
  }

  function endCardDrag(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const { currentX, startX, moved } = drag;
    try { trackEl.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    trackEl.classList.remove("dragging");
    drag = null;

    if (!moved) return; // a plain tap/click — let the native click event through (word reveal)

    const dx = currentX - startX;
    const threshold = cardWidthPx() * SWIPE_ADVANCE_RATIO;
    if (dx <= -threshold) {
      slideAndAdvance("left");
    } else if (dx >= threshold) {
      slideAndAdvance("right");
    } else {
      setTrackTransition(true);
      setTrackOffset(0);
    }
  }

  trackEl.addEventListener("pointerdown", onCardPointerDown);
  trackEl.addEventListener("pointermove", onCardPointerMove);
  trackEl.addEventListener("pointerup", endCardDrag);
  trackEl.addEventListener("pointercancel", endCardDrag);

  function markShownAndAdvance() {
    if (ENTRIES.length === 0) return;
    recordShown(ENTRIES[index]);
    next();
  }

  function markKnownAndAdvance() {
    if (ENTRIES.length === 0) return;
    const entry = ENTRIES[index];

    performWrite("mark-known", USER_EMAIL, LANG, entry.wordId);
    // Other tabs read the shared word list once per (user, lang,
    // sentenceLang, cueLang) session now, not on every tab switch — patch
    // it in place so switching to another tab still reflects this
    // immediately, the way it used to happen by timing accident whenever
    // that tab's own independent background refresh landed afterward.
    patchUserWord(USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG, entry.wordId, { show: false });

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
    patchUserWord(USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG, entry.wordId, { show: true });

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

  prevBtn.addEventListener("click", () => slideAndAdvance("right"));
  nextBtn.addEventListener("click", () => slideAndAdvance("left"));
  knowBtn.addEventListener("click", markKnownAndAdvance);
  nextWordBtn.addEventListener("click", markShownAndAdvance);

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    // This listener lives on window and this component stays mounted for
    // the app's lifetime (only its panel's display is toggled on tab
    // switch — see App.vue's switchTopicTab), so without this guard it
    // would preventDefault() and act on arrow keys/space/enter no matter
    // which tab is actually open — notably swallowing Game.vue's arrow-key
    // movement, since Phaser's own keydown handler skips any event that
    // already arrived with defaultPrevented set.
    if (panelEl.style.display === "none") return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); slideAndAdvance("left"); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); slideAndAdvance("right"); }
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
    setLoading(true);
    try {
      const rawWords = await loadUserWords(USER_EMAIL, LANG, SENTENCE_LANG, CUE_LANG);
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
