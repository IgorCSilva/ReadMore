<template>
  <div class="flow-topbar">
    <div class="flow-progress">
      <div class="flow-progress-fill" :style="{ width: progressPercent + '%' }"></div>
    </div>
    <button type="button" class="flow-exit-btn" @click="exit" aria-label="Exit">✕</button>
  </div>

  <div class="flow-page">
    <div class="flow-loading" v-if="isLoading">
      <div class="flow-spinner"></div>
    </div>

    <div class="word-page-1" v-else-if="currentStep?.kind === 'word' && currentStep.pageNumber === 1">
      <div class="word-page-1-image-wrap" v-if="imageOk">
        <img :src="imageUrl" @error="onImageError" alt="" />
      </div>
      <div class="word-page-1-cue-big" v-else>{{ currentStep.word.cue }}</div>

      <div class="word-page-1-cue" v-if="imageOk">{{ currentStep.word.cue }}</div>

      <div class="word-page-1-word-row">
        <span class="word-page-1-word">{{ currentStep.word.original }}</span>
        <button type="button" class="word-page-1-audio-btn" @click="playAudio(currentStep.word.original)" aria-label="Play audio">🔊</button>
      </div>
    </div>

    <div class="word-page-2" v-else-if="currentStep?.kind === 'word' && currentStep.pageNumber === 2">
      <div class="word-page-2-word">{{ currentStep.word.original }}</div>

      <div class="word-page-2-controls">
        <button
          type="button"
          class="word-page-2-mic-btn"
          :disabled="speechState === 'listening' || !speechSupported"
          @click="startListening"
          aria-label="Record your voice"
        >
          🎤
        </button>

        <div class="word-page-2-wave" v-if="speechState === 'listening'">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="word-page-2-result success" v-else-if="speechState === 'success'">
          ✓ Correct!
        </div>
        <div class="word-page-2-result failure" v-else-if="speechState === 'failure'">
          Not quite — try saying it again.
        </div>
        <div class="word-page-2-hint" v-else-if="speechState === 'unsupported'">
          Voice recognition isn't supported in this browser.
        </div>
      </div>
    </div>

    <div class="word-page-3" v-else-if="currentStep?.kind === 'word' && currentStep.pageNumber === 3">
      <div class="word-page-1-image-wrap" v-if="imageOk">
        <img :src="imageUrl" @error="onImageError" alt="" />
      </div>
      <div class="word-page-1-cue-big" v-else>{{ currentStep.word.cue }}</div>

      <div class="word-page-1-cue" v-if="imageOk">{{ currentStep.word.cue }}</div>

      <div class="word-page-3-input-row">
        <input
          type="text"
          class="word-page-3-input"
          :class="{ success: writeState === 'success' }"
          v-model="writtenText"
          :disabled="writeState === 'success'"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          @keydown.enter.prevent="checkWritten"
        />
        <button type="button" class="word-page-1-audio-btn" @click="playAudio(currentStep.word.original)" aria-label="Play audio">🔊</button>
      </div>

      <div class="word-page-3-result" v-if="writeState !== 'idle'">
        <span
          v-for="(op, opIndex) in writeDiff"
          :key="opIndex"
          :class="`word-page-3-letter-${op.type}`"
        >{{ op.type !== 'correct' && op.char === ' ' ? '␣' : op.char }}</span>
      </div>

      <button
        type="button"
        class="word-page-3-check-btn"
        :disabled="writeState === 'success'"
        @click="checkWritten"
        aria-label="Check answer"
      >
        ✓
      </button>
    </div>

    <!-- Listen-and-write isn't designed yet — a placeholder keeps the
         sequence/progress/Next mechanics working end to end already. -->
    <div class="placeholder-page" v-else-if="currentStep?.kind === 'word'">
      Page {{ currentStep.pageNumber }} — coming soon
    </div>

    <div class="reading-page" v-else-if="currentStep?.kind === 'reading'">
      <div class="reading-page-counter" v-if="readingWords.length">
        {{ readingIndex + 1 }} / {{ readingWords.length }}
      </div>

      <button type="button" class="reading-page-card" @click="readingNext">
        <span class="reading-page-word" :style="{ color: readingWordColor }">{{ readingWordText }}</span>
      </button>

      <div class="reading-page-hint">Tap the word for the next one</div>

      <div class="reading-page-controls">
        <button
          type="button"
          class="reading-page-autopass-btn"
          :class="{ pressed: readingAutoPass }"
          @click="toggleReadingAutoPass"
        >
          Auto-pass
        </button>

        <div class="reading-page-velocity">
          <label for="reading-page-velocity-range">Speed</label>
          <input
            id="reading-page-velocity-range"
            type="range"
            min="1"
            :max="READING_VELOCITY_MAX"
            v-model.number="readingVelocity"
          />
        </div>
      </div>
    </div>
    <div class="listen-write-page" v-else-if="currentStep?.kind === 'listen-write'">
      <Dictation ref="dictationRef" />
    </div>
  </div>

  <div class="flow-bottombar">
    <button type="button" class="flow-next-btn" :disabled="isBottomBarDisabled" @click="handleBottomBarClick">
      {{ isLastStep ? 'Finish' : 'Next' }}
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Dictation from '../features/dictation/Dictation.vue'
import { getChapters, getWords, ttsUrl } from '../shared/api'
import { ensureUserEmail } from '../shared/currentUser'
import { formatWordByGender, getGender } from '../shared/genders'
import { requestHomeExpansion } from '../shared/homeExpansion'
import { formatWordByParticle, getParticle } from '../shared/koreanParticles'
import { speechLocaleFor } from '../shared/languages'
import { buildPartFlowSequence } from '../shared/partFlow'
import { numberedPartsCount, wordIdsForPart } from '../shared/topicParts'

// Hardcoded until a language picker exists on the new pages — matches the
// app's existing default language elsewhere (see HomePage.vue).
const LANG = 'pt-en'
const EXT_FALLBACKS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'jfif']

function shuffle(items) {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const route = useRoute()
const router = useRouter()

const topic = ref(null)
const words = ref([])
const sequence = ref([])
const stepIndex = ref(0)
const isLoading = ref(true)
const dictationRef = ref(null)

const currentStep = computed(() => sequence.value[stepIndex.value] ?? null)
const progressPercent = computed(() =>
  sequence.value.length ? ((stepIndex.value + 1) / sequence.value.length) * 100 : 0
)

function exit() {
  router.push('/')
}

function next() {
  if (stepIndex.value < sequence.value.length - 1) stepIndex.value++
}

const isLastStep = computed(() => sequence.value.length > 0 && stepIndex.value === sequence.value.length - 1)

// Page 3 (type the word) is the only step that gates the bottom bar: the
// Check button is the intended way to confirm an answer, but the bar's own
// Next must stay locked until that's actually done, not offer a silent
// skip-without-typing shortcut.
const isBottomBarDisabled = computed(() => {
  const step = currentStep.value
  if (step?.kind === 'word' && step.pageNumber === 3) return writeState.value !== 'success'
  return false
})

// The last step's bottom-bar button doesn't advance within the flow (there's
// nothing after it) — it ends the part and returns to Home, with the next
// part in the same topic pre-expanded so continuing the topic is a single
// tap away instead of re-finding it in the accordion.
function handleBottomBarClick() {
  if (isLastStep.value) {
    finishPart()
  } else {
    next()
  }
}

function finishPart() {
  const topicId = route.params.topicId
  const currentPartNumber = Number(route.params.partNumber)
  const count = numberedPartsCount(topic.value)
  // partsForTopic's index = partNumber - 1 for numbered parts (0-based), so
  // the next numbered part's index equals the current (1-based) partNumber.
  // If this was the last numbered part, fall through to "Read and
  // Understand" — the next entry in that same accordion list — at index
  // `count` (right after the `count` numbered parts occupying indices 0..count-1).
  const nextPartIndex = currentPartNumber < count ? currentPartNumber : count
  requestHomeExpansion({ topicId, partIndex: nextPartIndex })
  router.push('/')
}

// ---- Page 1's image (or big-cue fallback), mirrors Flashcards.vue's own
// extension-fallback probing (loadImageForSlot) so both pages resolve the
// same word's image the same way. ----

const imageBase = ref('')
const imageCandidates = ref([])
const imageCandidateIndex = ref(0)
const imageOk = ref(false)

// Absolute path — unlike Flashcards.vue's own relative "images/..." (safe
// there since it only ever renders at shallow routes like "/" or "/library"),
// this page is mounted at "/part/:topicId/:partNumber": a relative path
// would resolve against that deeper URL (e.g. "/part/t1/images/...") and
// 404 every candidate, always falling back to the cue even when a real
// image exists.
const imageUrl = computed(() => `/images/${imageBase.value}.${imageCandidates.value[imageCandidateIndex.value]}`)

function startImageLoad(filename) {
  const dot = (filename || '').lastIndexOf('.')
  const ext = dot >= 0 ? filename.slice(dot + 1) : 'png'
  const base = dot >= 0 ? filename.slice(0, dot) : filename
  imageBase.value = base || ''
  imageCandidates.value = [...new Set([ext, ...EXT_FALLBACKS])]
  imageCandidateIndex.value = 0
  imageOk.value = !!filename
}

function onImageError() {
  if (imageCandidateIndex.value < imageCandidates.value.length - 1) {
    imageCandidateIndex.value++
  } else {
    imageOk.value = false
  }
}

watch(currentStep, (step) => {
  if (step?.kind === 'word' && (step.pageNumber === 1 || step.pageNumber === 3)) {
    startImageLoad(step.word.filename)
  }
  if (step?.kind === 'word' && step.pageNumber === 2) {
    resetSpeechState()
  } else {
    stopRecognition()
  }
  window.clearTimeout(writeAdvanceTimer)
  writeAdvanceTimer = null
  if (step?.kind === 'word' && step.pageNumber === 3) {
    writtenText.value = ''
    writeState.value = 'idle'
    writeDiff.value = []
  }
  if (step?.kind === 'reading') {
    startReading()
  } else {
    window.clearTimeout(readingAutoTimer)
    readingAutoTimer = null
  }
  if (step?.kind === 'listen-write') {
    startListenWrite()
  } else {
    dictationRef.value?.pause()
  }
})

// ---- Audio, mirrors Flashcards.vue's speakWord/speakWordLocal fallback. ----

function targetLangCode() {
  const [, target] = LANG.split('-')
  return target || LANG
}

function speakLocal(text, langCode) {
  if (!('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = speechLocaleFor(langCode)
  window.speechSynthesis.speak(utterance)
}

function playAudio(text) {
  if (!text) return
  const langCode = targetLangCode()
  const audio = new Audio(ttsUrl(text, langCode))
  audio.addEventListener('error', () => speakLocal(text, langCode))
  audio.play().catch(() => speakLocal(text, langCode))
}

// ---- Page 2's voice recognition, via the browser's Web Speech API — no
// backend STT exists in this app (only TTS), and this API needs no server
// round-trip. Reliable mainly in Chrome/Edge; other browsers fall back to
// the "unsupported" state below instead of a broken mic button. ----

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
const speechSupported = !!SpeechRecognitionCtor

const speechState = ref(speechSupported ? 'idle' : 'unsupported')
let recognition = null
let speechAdvanceTimer = null

function resetSpeechState() {
  stopRecognition()
  speechState.value = speechSupported ? 'idle' : 'unsupported'
}

function stopRecognition() {
  window.clearTimeout(speechAdvanceTimer)
  speechAdvanceTimer = null
  if (!recognition) return
  recognition.onresult = null
  recognition.onerror = null
  recognition.onend = null
  recognition.abort()
  recognition = null
}

// Loose match: case/accent/punctuation-insensitive, since speech transcripts
// rarely come back with the exact casing or punctuation of the target word.
function normalizeSpeech(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
}

function startListening() {
  if (!speechSupported || speechState.value === 'listening') return
  const word = currentStep.value?.word
  if (!word) return

  stopRecognition()
  recognition = new SpeechRecognitionCtor()
  recognition.lang = speechLocaleFor(targetLangCode())
  recognition.interimResults = false
  recognition.maxAlternatives = 3

  recognition.onresult = (event) => {
    const target = normalizeSpeech(word.original)
    const said = Array.from(event.results[0]).map((alt) => normalizeSpeech(alt.transcript))
    if (said.includes(target)) {
      speechState.value = 'success'
      speechAdvanceTimer = window.setTimeout(next, 1000)
    } else {
      speechState.value = 'failure'
    }
  }
  recognition.onerror = () => {
    speechState.value = 'failure'
  }
  recognition.onend = () => {
    if (speechState.value === 'listening') speechState.value = 'failure'
  }

  speechState.value = 'listening'
  recognition.start()
}

// ---- Page 3's type-the-word check, mirrors Dictation.vue's per-letter diff
// (buildAlignment/isWordCorrect/normalizeChar) so this page and the Dictation
// tab give identical right/wrong feedback for the same kind of exercise. ----

const writtenText = ref('')
const writeState = ref('idle') // 'idle' | 'wrong' | 'success'
const writeDiff = ref([])
let writeAdvanceTimer = null

const APOSTROPHE_VARIANTS = /[‘’`]/g

function normalizeChar(ch) {
  return ch.normalize('NFC').toLowerCase().replace(APOSTROPHE_VARIANTS, "'")
}

function isWordCorrect(typed, target) {
  if (typed.length !== target.length) return false
  for (let i = 0; i < target.length; i++) {
    if (normalizeChar(typed[i]) !== normalizeChar(target[i])) return false
  }
  return true
}

function buildAlignment(typed, target) {
  const typedChars = Array.from(typed.normalize('NFC'))
  const targetChars = Array.from(target.normalize('NFC'))
  const normTyped = typedChars.map(normalizeChar)
  const normTarget = targetChars.map(normalizeChar)
  const n = typedChars.length
  const m = targetChars.length

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = normTyped[i - 1] === normTarget[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const ops = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normTyped[i - 1] === normTarget[j - 1]) {
      ops.push({ type: 'correct', char: targetChars[j - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'missing', char: targetChars[j - 1] })
      j--
    } else {
      ops.push({ type: 'wrong', char: typedChars[i - 1] })
      i--
    }
  }
  ops.reverse()
  return ops
}

function checkWritten() {
  if (writeState.value === 'success') return
  const word = currentStep.value?.word
  if (!word) return

  writeDiff.value = buildAlignment(writtenText.value, word.original)
  if (isWordCorrect(writtenText.value, word.original)) {
    writeState.value = 'success'
    writeAdvanceTimer = window.setTimeout(next, 1000)
  } else {
    writeState.value = 'wrong'
  }
}

// ---- Reading step: a bare "tap the card for the next word" drill over just
// this part's words, mirroring Reading.vue's card/shuffle/gender-color
// behavior. Unlike Reading.vue, this pool is fixed to the part's own words
// (no confidence filtering, no reinforcement words — those are user-progress
// concepts this flow doesn't touch), and it adds an optional auto-pass timer
// Reading.vue doesn't have. ----

const READING_VELOCITY_MAX = 10
const READING_VELOCITY_DEFAULT = 3
// Higher speed = shorter on-screen time: ms-per-character runs from
// READING_VELOCITY_UNIT_MS * MAX at speed 1 (slowest) down to
// READING_VELOCITY_UNIT_MS at speed MAX (fastest) — e.g. a 5-letter word at
// the fastest speed stays up only 5 * 100 = 500ms, at the slowest 5 * 1000 = 5000ms.
const READING_VELOCITY_UNIT_MS = 100

const readingWords = ref([])
const readingIndex = ref(0)
const readingAutoPass = ref(false)
const readingVelocity = ref(READING_VELOCITY_DEFAULT)
let readingAutoTimer = null

const currentReadingWord = computed(() => readingWords.value[readingIndex.value] ?? null)

const readingWordText = computed(() => {
  const word = currentReadingWord.value
  if (!word) return ''
  const gender = getGender(word.gender_id)
  return gender.color
    ? formatWordByGender(word.original, word.gender_id)
    : formatWordByParticle(word.original, word.particle_type)
})

const readingWordColor = computed(() => {
  const word = currentReadingWord.value
  if (!word) return ''
  return getGender(word.gender_id).color || getParticle(word.particle_type).color || ''
})

function scheduleReadingAutoPass() {
  window.clearTimeout(readingAutoTimer)
  readingAutoTimer = null
  if (!readingAutoPass.value) return
  const word = currentReadingWord.value
  if (!word) return
  const msPerChar = (READING_VELOCITY_MAX + 1 - readingVelocity.value) * READING_VELOCITY_UNIT_MS
  const duration = word.original.length * msPerChar
  readingAutoTimer = window.setTimeout(readingNext, duration)
}

// A random pick among "the others" (never repeats the word on screen): an
// offset of 1..length-1 from the current index, wrapped, guarantees a
// different word every time without a reject-and-retry loop (which would
// spin forever under a mocked Math.random in tests).
function readingNext() {
  const n = readingWords.value.length
  if (!n) return
  if (n > 1) {
    const offset = 1 + Math.floor(Math.random() * (n - 1))
    readingIndex.value = (readingIndex.value + offset) % n
  }
  scheduleReadingAutoPass()
}

function toggleReadingAutoPass() {
  readingAutoPass.value = !readingAutoPass.value
  scheduleReadingAutoPass()
}

watch(readingVelocity, () => {
  if (readingAutoPass.value) scheduleReadingAutoPass()
})

function startReading() {
  readingWords.value = shuffle(words.value)
  readingIndex.value = 0
  scheduleReadingAutoPass()
}

// ---- Listen-and-write step: the Dictation tab's own listen-then-type drill
// (TTS audio, hidden word, type it, per-letter diff on check, 1s auto-advance
// on a correct guess), reused as-is rather than re-implemented — porting a
// second copy of its diff/composition/audio-fallback logic risked drifting
// from "equal the Dictation tab". The only difference from the tab's own
// usage is the word pool: passed in directly as this part's words
// (Dictation's wordsOverride param) instead of letting it fetch+filter the
// whole topic by confidence/show, matching how Page 3 and the Reading step
// also bypass user-progress filtering. ----

function startListenWrite() {
  nextTick(() => {
    const panel = document.getElementById('topic-dictation-panel')
    if (panel) panel.style.display = 'flex'
    dictationRef.value?.show(ensureUserEmail(), LANG, topic.value, 'target', 'origin', [], words.value)
  })
}

// ---- Load the topic + the up-to-5 words for this part, then shuffle. ----

async function load() {
  isLoading.value = true
  try {
    const email = ensureUserEmail()
    const topicId = route.params.topicId
    const partNumber = Number(route.params.partNumber)

    const [chaptersData, wordsData] = await Promise.all([
      getChapters(email, LANG),
      getWords(LANG),
    ])

    let foundTopic = null
    for (const chapter of chaptersData.chapters || []) {
      foundTopic = chapter.topics.find((t) => t.topic_id === topicId)
      if (foundTopic) break
    }
    topic.value = foundTopic || null
    if (!foundTopic) return

    const wordIds = wordIdsForPart(foundTopic, partNumber)
    const byId = {}
    for (const word of wordsData.words || []) byId[word.word_id] = word
    words.value = wordIds.map((id) => byId[id]).filter(Boolean)

    sequence.value = buildPartFlowSequence(words.value)
    stepIndex.value = 0
  } finally {
    isLoading.value = false
  }
}

// body's global padding (App.vue) exists for the normal centered-card pages
// — this is a full-bleed, fixed-top/bottom-bar page instead, so that padding
// only pushes .flow-page's own min-height:100vh past the viewport and forces
// a scrollbar with blank space at the bottom. Suppressed only while mounted.
onMounted(() => {
  document.body.classList.add('part-flow-active')
  load()
})
// Dictation keeps a pending 1s auto-advance timer (and possibly playing TTS
// audio) until pause() is called — leaving the flow via Exit mid-Listen-and-
// write must stop it explicitly, the same way switching tabs away from
// Dictation in LibraryPage.vue does. Must run in onBeforeUnmount, not
// onUnmounted: by the time onUnmounted fires, the <Dictation> child has
// already been torn down and dictationRef.value is back to null.
onBeforeUnmount(() => {
  dictationRef.value?.pause()
})

onUnmounted(() => {
  document.body.classList.remove('part-flow-active')
})
</script>

<style>
body.part-flow-active {
  padding: 0;
}
</style>

<style scoped>
.flow-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  z-index: 100;
}

.flow-progress {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--border);
  overflow: hidden;
}

.flow-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}

.flow-exit-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
}

.flow-exit-btn:hover {
  background: var(--border);
  color: var(--text);
}

.flow-page {
  width: 100%;
  max-width: 640px;
  padding-top: 56px;
  padding-bottom: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 20px;
}

.flow-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flow-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: flow-spin 0.8s linear infinite;
}

@keyframes flow-spin {
  to { transform: rotate(360deg); }
}

.word-page-1 {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.word-page-1-image-wrap {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}

.word-page-1-image-wrap img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.word-page-1-cue-big {
  font-size: clamp(24px, 6vw, 40px);
  font-weight: 700;
  text-align: center;
  color: var(--text);
}

.word-page-1-cue {
  font-size: 16px;
  color: var(--muted);
  text-align: center;
}

.word-page-1-word-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.word-page-1-word {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
}

.word-page-1-audio-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}

.word-page-1-audio-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.word-page-2 {
  position: relative;
  width: 100%;
  flex: 1;
  align-self: stretch;
}

.word-page-2-word {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  padding: 0 24px;
  font-size: clamp(28px, 7vw, 44px);
  font-weight: 700;
  text-align: center;
  color: var(--text);
}

.word-page-2-controls {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: 100%;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.word-page-2-mic-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 40px;
  line-height: 1;
  cursor: pointer;
  margin-bottom: 46px;
}

.word-page-2-mic-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.word-page-2-mic-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.word-page-2-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
}

.word-page-2-wave span {
  width: 5px;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  animation: word-page-2-wave-bounce 0.9s ease-in-out infinite;
}

.word-page-2-wave span:nth-child(2) { animation-delay: 0.1s; }
.word-page-2-wave span:nth-child(3) { animation-delay: 0.2s; }
.word-page-2-wave span:nth-child(4) { animation-delay: 0.3s; }
.word-page-2-wave span:nth-child(5) { animation-delay: 0.4s; }

@keyframes word-page-2-wave-bounce {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}

.word-page-2-result {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.word-page-2-result.success {
  color: var(--accent);
}

.word-page-2-result.failure {
  color: #d33;
}

.word-page-2-hint {
  font-size: 14px;
  color: var(--muted);
  text-align: center;
}

.word-page-3 {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.word-page-3-input-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.word-page-3-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  color: var(--text);
  border: none;
  border-bottom: 2px solid var(--border);
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  font-family: inherit;
  padding: 6px 4px;
}

.word-page-3-input:focus {
  outline: none;
  border-bottom-color: var(--accent);
}

.word-page-3-input.success {
  border-bottom-color: var(--accent);
  color: var(--accent);
}

.word-page-3-result {
  display: flex;
  align-items: baseline;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1px;
  font-size: 22px;
  font-weight: 700;
}

.word-page-3-letter-correct,
.word-page-3-letter-missing,
.word-page-3-letter-wrong {
  display: inline-block;
  white-space: pre;
}

.word-page-3-letter-correct {
  color: var(--accent);
}

.word-page-3-letter-missing {
  color: var(--muted);
  opacity: 0.5;
}

.word-page-3-letter-wrong {
  color: #e0453a;
  font-size: 0.7em;
}

.word-page-3-check-btn {
  align-self: flex-end;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
}

.word-page-3-check-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.word-page-3-check-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.placeholder-page {
  color: var(--muted);
  font-size: 16px;
  text-align: center;
}

.reading-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.reading-page-counter {
  font-size: 14px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.reading-page-card {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 360px;
  min-height: 180px;
  padding: 32px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.reading-page-card:hover {
  border-color: var(--accent);
}

.reading-page-word {
  font-size: clamp(28px, 7vw, 48px);
  font-weight: 800;
  text-align: center;
  word-break: break-word;
  color: var(--text);
}

.reading-page-hint {
  font-size: 13px;
  color: var(--muted);
}

.reading-page-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.reading-page-autopass-btn {
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.reading-page-autopass-btn:hover {
  border-color: var(--accent);
}

.reading-page-autopass-btn.pressed {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.reading-page-velocity {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}

.listen-write-page {
  width: 100%;
}

.flow-bottombar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  background: var(--card);
  border-top: 1px solid var(--border);
  z-index: 100;
}

.flow-next-btn {
  width: 100%;
  max-width: 640px;
  height: 40px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.flow-next-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.flow-next-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
