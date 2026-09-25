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

    <!-- Reading and Listen-and-write aren't designed yet — placeholders
         keep the sequence/progress/Next mechanics working end to end already. -->
    <div class="placeholder-page" v-else-if="currentStep?.kind === 'word'">
      Page {{ currentStep.pageNumber }} — coming soon
    </div>
    <div class="placeholder-page" v-else-if="currentStep?.kind === 'reading'">
      Reading page — coming soon
    </div>
    <div class="placeholder-page" v-else-if="currentStep?.kind === 'listen-write'">
      Listen and write page — coming soon
    </div>
  </div>

  <div class="flow-bottombar">
    <button type="button" class="flow-next-btn" @click="next">Next</button>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getChapters, getWords, ttsUrl } from '../shared/api'
import { ensureUserEmail } from '../shared/currentUser'
import { speechLocaleFor } from '../shared/languages'
import { buildPartFlowSequence } from '../shared/partFlow'
import { wordIdsForPart } from '../shared/topicParts'

// Hardcoded until a language picker exists on the new pages — matches the
// app's existing default language elsewhere (see HomePage.vue).
const LANG = 'pt-en'
const EXT_FALLBACKS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'jfif']

const route = useRoute()
const router = useRouter()

const topic = ref(null)
const words = ref([])
const sequence = ref([])
const stepIndex = ref(0)
const isLoading = ref(true)

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
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px;
}

.word-page-2-word {
  font-size: clamp(28px, 7vw, 44px);
  font-weight: 700;
  text-align: center;
  color: var(--text);
}

.word-page-2-mic-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  margin-top: 24px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 40px;
  line-height: 1;
  cursor: pointer;
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

.flow-next-btn:hover {
  background: var(--accent-strong);
}
</style>
