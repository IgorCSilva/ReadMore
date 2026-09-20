<template>
  <div id="topic-typing-panel" style="display:none">
    <div class="error-banner" id="typing-error-banner"></div>

    <div class="loading" id="typing-loading">
      <div class="spinner"></div>
      <div>Loading your words…</div>
    </div>

    <div class="empty-state" id="typing-empty-state">No learning words for this topic yet.</div>

    <div class="typing-stage" id="typing-stage">
      <div class="typing-danger-zone"></div>
      <div class="typing-hud">
        <span>caught <b id="typing-hud-caught">0</b></span>
        <span class="typing-hud-missed">missed <b id="typing-hud-missed">0</b></span>
      </div>
      <div class="typing-lanes" id="typing-lanes"></div>
      <div class="typing-flyers" id="typing-flyers"></div>
    </div>
    <div class="typing-controls" id="typing-controls">
      <div class="typing-hint">Type a word's first letter to target it, then keep typing to finish it before it crosses the red line</div>
      <div class="typing-controls-actions">
        <label class="typing-speed-label">Speed
          <select id="typing-speed-select">
            <option value="0.7">Slow</option>
            <option value="1" selected>Normal</option>
            <option value="1.4">Fast</option>
            <option value="1.8">Very fast</option>
          </select>
        </label>
        <button type="button" class="typing-reset-btn" id="typing-reset-btn">↺ Reset</button>
      </div>
    </div>

    <!-- Typing is captured here, not via document keydown — a real input's
         "input"/"composition*" events are what correctly reports the
         composed character from a dead-key sequence (´ then i -> í) or an
         IME/mobile keyboard, where a raw keydown would only ever see the
         uncomposed key. Visually hidden (clipped), not display:none, since
         it must stay focusable to keep receiving keystrokes. -->
    <input type="text" id="typing-key-capture" class="typing-key-capture" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-hidden="true" tabindex="-1">
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { getUserWords } from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { readStale, refreshInBackground } from '../../shared/dataSync'

// New tab, to the right of Reading: words fly right-to-left across a set of
// lanes; typing them correctly is the point ("stimulate reading" via active
// production, not just recognition). Word pool is the same "learning words
// for this topic" population as Reading (show !== false && !confident),
// mirrors Reading's "user-words" cache key/shape.
//
// Design carried over from the concept prototype we iterated on before
// wiring this in:
//  - Each letter is plain white; opacity 0.6 until typed, 1 once typed, and
//    the whole word recolors to var(--accent) — the app's existing
//    per-language accent (see App.vue's data-lang trio) — once complete.
//  - The stage is always a dark canvas regardless of the app's light/dark
//    theme: the mechanic *is* white-on-black opacity, so it doesn't adapt.
//  - Several words drift at once, but only one is "live" at a time — the
//    first correct next-letter typed locks onto that word (the standard
//    "type to target" convention, e.g. ZType); wrong keys are ignored.
//    Reaching the red line before finishing counts as a miss.
//  - Accents are matched exactly (cómo needs an actual ó), and dead-key /
//    IME composition is handled via composition events rather than
//    document keydown — see the note by the capture <input> above, and the
//    "composing" handling below.
//  - Target vocabulary isn't always one token (e.g. "de nada", "por
//    favor") — the space bar is a typeable character like any letter, and
//    each letter span preserves a lone space's width in CSS instead of
//    collapsing it away.
//  - Reset restarts the round in place (score back to 0, board cleared)
//    without refetching; Speed scales newly-spawned words' fly speed only,
//    not ones already in flight.
//
// The animation loop runs continuously once mounted but is a no-op whenever
// `playing` is false, so idle cost (tab never opened, or navigated away
// from) is a single early-return check per frame, not idle spawning.

const LANES = 5;

let USER_EMAIL = null;
let LANG = "pt-en";
let SENTENCE_LANG = "target";
let CUE_LANG = "origin";
let currentTopic = null;
let WORDS = [];

let show;
let pause;

onMounted(() => {
  const errorBanner = document.getElementById("typing-error-banner");
  const loadingEl = document.getElementById("typing-loading");
  const emptyStateEl = document.getElementById("typing-empty-state");
  const stageEl = document.getElementById("typing-stage");
  const controlsEl = document.getElementById("typing-controls");
  const lanesEl = document.getElementById("typing-lanes");
  const flyersEl = document.getElementById("typing-flyers");
  const hudCaught = document.getElementById("typing-hud-caught");
  const hudMissed = document.getElementById("typing-hud-missed");
  const keyCapture = document.getElementById("typing-key-capture");
  const speedSelect = document.getElementById("typing-speed-select");
  const resetBtn = document.getElementById("typing-reset-btn");

  let playing = false;
  let flyers = [];
  let nextId = 1;
  let activeId = null;
  let spawnTimer = 0;
  let caught = 0;
  let missed = 0;
  let lastTime = null;
  // Applied to each flyer's speed at spawn time only — changing it mid-round
  // doesn't retroactively rescale words already in flight, only the ones
  // that spawn from then on, which keeps this simple (no compounding, no
  // rewriting an in-progress flyer's remaining travel time/position).
  let speedMultiplier = 1;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      controlsEl.style.display = "none";
      emptyStateEl.style.display = "none";
    }
  }

  // NFC only canonicalizes equivalent Unicode encodings of the same
  // character (a precomposed "ó" vs. "o" + a combining acute accent from a
  // dead-key layout) — it does NOT strip the accent. "cómo" must be typed
  // with its accent; a bare "o" is a genuinely different letter.
  function normalize(ch) {
    return ch.normalize("NFC").toLowerCase();
  }

  function transformAndFilter(rawWords) {
    const byId = new Map(rawWords.map((w) => [w.word_id, w]));
    return (currentTopic?.word_ids || [])
      .map((id) => byId.get(id))
      .filter((w) => w && w.show !== false && !w.confident)
      .map((w) => ({ wordId: w.word_id, word: w.original }));
  }

  function applyWords(rawWords) {
    WORDS = transformAndFilter(rawWords);
  }

  function randomWord() {
    // Prefer a word that isn't already drifting on screen, so the same
    // word doesn't appear twice at once when the pool allows better —
    // falls back to any pool word once every word is already in flight.
    const inFlight = new Set(flyers.filter((f) => f.state === "flying").map((f) => f.word));
    const fresh = WORDS.filter((w) => !inFlight.has(w.word));
    const pool = fresh.length > 0 ? fresh : WORDS;
    return pool[Math.floor(Math.random() * pool.length)].word;
  }

  function laneY(index, stageHeight) {
    const pad = stageHeight * 0.1;
    const usable = stageHeight - pad * 2;
    return pad + (usable * index) / (LANES - 1);
  }

  function drawLanes() {
    lanesEl.innerHTML = "";
    const rect = stageEl.getBoundingClientRect();
    for (let i = 0; i < LANES; i++) {
      const guide = document.createElement("div");
      guide.className = "typing-lane-guide";
      guide.style.top = `${laneY(i, rect.height)}px`;
      lanesEl.appendChild(guide);
    }
  }

  function buildLetterSpans(container, word) {
    container.innerHTML = "";
    for (const ch of word) {
      const span = document.createElement("span");
      span.className = "typing-letter";
      span.textContent = ch;
      container.appendChild(span);
    }
  }

  function updateFlyerLetters(flyer) {
    const spans = flyer.el.children;
    for (let i = 0; i < spans.length; i++) {
      spans[i].classList.toggle("typed", i < flyer.typed);
    }
  }

  function positionFlyer(flyer) {
    flyer.el.style.transform = `translate3d(${flyer.x}px, ${flyer.y}px, 0)`;
  }

  function spawnFlyer() {
    if (WORDS.length === 0) return;
    const word = randomWord();
    const el = document.createElement("div");
    el.className = "typing-flyer";
    buildLetterSpans(el, word);
    flyersEl.appendChild(el);

    const rect = stageEl.getBoundingClientRect();
    const lane = Math.floor(Math.random() * LANES);
    const flyer = {
      id: nextId++,
      word,
      typed: 0,
      x: rect.width + 40,
      y: laneY(lane, rect.height),
      speed: (34 + Math.random() * 14) * speedMultiplier,
      el,
      state: "flying",
    };
    positionFlyer(flyer);
    flyers.push(flyer);
  }

  function removeFlyer(flyer, delay) {
    window.setTimeout(() => {
      flyer.el.parentNode?.removeChild(flyer.el);
    }, delay || 0);
    flyers = flyers.filter((f) => f.id !== flyer.id);
    if (activeId === flyer.id) activeId = null;
  }

  function clearFlyers() {
    // Wipes every child unconditionally, not just currently-tracked
    // flyers — a just-completed/missed flyer's fade-out is mid-flight via
    // a delayed removeFlyer() setTimeout (already spliced out of `flyers`
    // but not yet removed from the DOM) when Reset is hit, and should
    // disappear immediately along with everything else, not linger for
    // its animation to finish.
    flyersEl.innerHTML = "";
    flyers = [];
    activeId = null;
  }

  function scheduleSpawn() {
    spawnTimer = 0.5 + Math.random() * 1.1;
  }

  function stepSimulation(dt) {
    const rect = stageEl.getBoundingClientRect();
    const dangerX = Math.min(rect.width * 0.11, 110);

    for (const flyer of flyers) {
      if (flyer.state !== "flying") continue;
      flyer.x -= flyer.speed * dt;
      positionFlyer(flyer);

      if (flyer.x <= dangerX && flyer.typed < flyer.word.length) {
        flyer.state = "missed";
        flyer.el.classList.add("missed");
        missed++;
        hudMissed.textContent = String(missed);
        removeFlyer(flyer, 520);
      } else if (flyer.x < -240) {
        removeFlyer(flyer, 0);
      }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0 && WORDS.length > 0 && flyers.length < 6) {
      spawnFlyer();
      scheduleSpawn();
    }
  }

  function frame(t) {
    if (playing) {
      if (lastTime == null) lastTime = t;
      const dt = Math.min((t - lastTime) / 1000, 0.05);
      lastTime = t;
      stepSimulation(dt);
    } else {
      lastTime = null;
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);

  function processTypedChar(rawChar) {
    if (!playing) return;
    // \p{L} or a literal space — multi-word target vocabulary (e.g. "de
    // nada", "por favor") needs the space bar to be a valid, matchable
    // character in the sequence, not just letters.
    if (!/^[\p{L} ]$/u.test(rawChar)) return;
    const typedChar = normalize(rawChar);

    let target = activeId != null ? flyers.find((f) => f.id === activeId) : null;

    if (!target) {
      // Lock onto the first flying word (by screen position) whose next
      // letter matches — several words are drifting, but typing "picks"
      // which one you're now committed to.
      const candidates = flyers
        .filter((f) => f.state === "flying" && f.typed === 0)
        .sort((a, b) => a.x - b.x);
      target = candidates.find((f) => normalize(f.word[0]) === typedChar);
      if (!target) return;
      activeId = target.id;
    }

    const expected = normalize(target.word[target.typed]);
    if (expected !== typedChar) return;

    target.typed++;
    updateFlyerLetters(target);
    const justTyped = target.el.children[target.typed - 1];
    if (justTyped && !prefersReducedMotion) {
      justTyped.classList.add("pop");
      window.setTimeout(() => justTyped.classList.remove("pop"), 130);
    }

    if (target.typed === target.word.length) {
      target.state = "done";
      target.el.classList.add("done");
      activeId = null;
      caught++;
      hudCaught.textContent = String(caught);
      removeFlyer(target, 420);
    }
  }

  function focusCapture() {
    keyCapture.focus({ preventScroll: true });
  }

  // See the composition handling note on the capture <input> above — a
  // dead-key sequence runs as compositionstart -> compositionupdate(s)
  // (each *also* firing "input", flagged isComposing: true) ->
  // compositionend. Clearing the field's value on every "input" event
  // without regard for that would stomp the in-progress composition before
  // it ever resolves to the final accented character.
  let composing = false;
  // Chrome fires one more trailing "input" for the same commit right after
  // compositionend (already isComposing: false by then, so the guard below
  // wouldn't catch it) — holds whatever compositionend just committed so
  // that exact echo, and only that echo, is swallowed once. A time-based
  // window was tried here first and rejected: a fast next keystroke can
  // land within any fixed window just as easily as Chrome's duplicate
  // does, and would be wrongly eaten too. Comparing data instead of timing
  // only swallows a real duplicate of what was just typed.
  let pendingCompositionEcho = null;

  function acceptTypedData(data) {
    if (!data) return;
    const chars = Array.from(data);
    if (chars.length !== 1) return;
    processTypedChar(chars[0]);
  }

  keyCapture.addEventListener("compositionstart", () => {
    composing = true;
  });

  keyCapture.addEventListener("compositionend", (e) => {
    composing = false;
    keyCapture.value = "";
    pendingCompositionEcho = e.data;
    acceptTypedData(e.data);
  });

  keyCapture.addEventListener("input", (e) => {
    if (composing || e.isComposing) return;
    keyCapture.value = "";
    if (pendingCompositionEcho !== null) {
      const isEcho = e.data === pendingCompositionEcho;
      pendingCompositionEcho = null; // only ever guards the one input right after compositionend
      if (isEcho) return;
    }
    acceptTypedData(e.data);
  });

  // Stealing focus back onto keyCapture the instant anything else takes
  // it (previously also done unconditionally from a document-wide "click"
  // listener) is exactly what breaks a native <select>: a <select> closes
  // its open dropdown the moment it loses focus, so grabbing focus back on
  // the very next tick reopened-then-immediately-closed it on every click,
  // and left it unable to register a chosen option at all. The select is
  // the one control that needs to keep focus for the length of its own
  // interaction — its own "blur" (once the user is actually done with it,
  // whether they picked an option or clicked away) is what hands focus
  // back, not this generic handler.
  keyCapture.addEventListener("blur", () => {
    // The "is it the select?" check has to happen inside the deferred
    // callback, not synchronously here: at the exact moment blur fires on
    // the *old* element, document.activeElement isn't guaranteed to have
    // settled to the new one yet — checking it here would race and lose.
    // By the time this timeout runs, the focus transition is long done.
    window.setTimeout(() => {
      if (playing && document.activeElement !== speedSelect) focusCapture();
    }, 0);
  });

  window.addEventListener("resize", () => {
    if (stageEl.style.display !== "none") drawLanes();
  });

  speedSelect.addEventListener("change", () => {
    speedMultiplier = parseFloat(speedSelect.value) || 1;
  });

  speedSelect.addEventListener("blur", () => {
    if (playing) focusCapture();
  });

  resetBtn.addEventListener("click", () => {
    beginRound();
  });

  function beginRound() {
    clearFlyers();
    caught = 0;
    missed = 0;
    hudCaught.textContent = "0";
    hudMissed.textContent = "0";
    drawLanes();

    if (WORDS.length === 0) {
      stageEl.style.display = "none";
      controlsEl.style.display = "none";
      emptyStateEl.style.display = "block";
      playing = false;
      return;
    }

    emptyStateEl.style.display = "none";
    stageEl.style.display = "flex";
    controlsEl.style.display = "flex";
    scheduleSpawn();
    playing = true;
    focusCapture();
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
      beginRound();
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
      beginRound();
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
    return loadAndStart().catch(showError);
  };

  // Called by the shell when the user switches to a different tab — the
  // animation loop above is a no-op while !playing, so this is what stops
  // an off-screen tab from spawning/moving/missing words in the
  // background indefinitely. Reopening the tab calls show() again, which
  // always starts a fresh round (same convention as every other tab
  // reloading on activation), so state doesn't need to survive a pause.
  pause = () => {
    playing = false;
  };
});

defineExpose({
  show: (...args) => show(...args),
  pause: () => pause(),
});
</script>
