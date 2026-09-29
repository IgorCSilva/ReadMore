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

    <WordPage1
      v-else-if="currentStep?.kind === 'word' && currentStep.pageNumber === 1"
      :image-ok="imageOk"
      :image-url="imageUrl"
      :cue="currentStep.word.cue"
      :word="currentStep.word.original"
      :pinyin="currentStep.word.pinyin"
      :auxiliar-sentence="currentStep.word.auxiliar_sentence"
      @image-error="onImageError"
      @play-audio="playAudio(currentStep.word.original)"
    />

    <WordPage2
      v-else-if="currentStep?.kind === 'word' && currentStep.pageNumber === 2"
      :word="currentStep.word.original"
      :pinyin="currentStep.word.pinyin"
      :speech-state="speechState"
      :speech-supported="speechSupported"
      @start-listening="startListening"
    />

    <WordPage3
      v-else-if="currentStep?.kind === 'word' && currentStep.pageNumber === 3"
      :image-ok="imageOk"
      :image-url="imageUrl"
      :cue="currentStep.word.cue"
      v-model:written-text="writtenText"
      :write-state="writeState"
      :write-diff="writeDiff"
      @image-error="onImageError"
      @play-audio="playAudio(currentStep.word.original)"
      @check="checkWritten"
    />

    <!-- Listen-and-write isn't designed yet — a placeholder keeps the
         sequence/progress/Next mechanics working end to end already. -->
    <div class="placeholder-page" v-else-if="currentStep?.kind === 'word'">
      Page {{ currentStep.pageNumber }} — coming soon
    </div>

    <ReadingPage
      v-else-if="currentStep?.kind === 'reading'"
      :index="readingIndex"
      :total="readingWords.length"
      :word-text="readingWordText"
      :word-color="readingWordColor"
      :cue="readingWordCue"
      :auto-pass="readingAutoPass"
      v-model:velocity="readingVelocity"
      :velocity-max="READING_VELOCITY_MAX"
      @next="readingNext"
      @toggle-auto-pass="toggleReadingAutoPass"
      @play-audio="playAudio(currentReadingWord?.original)"
    />
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
import ReadingPage from '../components/ReadingPage.vue'
import WordPage1 from '../components/WordPage1.vue'
import WordPage2 from '../components/WordPage2.vue'
import WordPage3 from '../components/WordPage3.vue'
import Dictation from '../features/dictation/Dictation.vue'
import { getChapters, getReinforcementWords, getWords, ttsUrl } from '../shared/api'
import { ensureUserEmail } from '../shared/currentUser'
import { formatWordByGender, getGender } from '../shared/genders'
import { requestHomeExpansion } from '../shared/homeExpansion'
import { formatWordByParticle, getParticle } from '../shared/koreanParticles'
import { speechLocaleFor } from '../shared/languages'
import { getLangPair } from '../shared/languagePreference'
import { buildPartFlowSequence } from '../shared/partFlow'
import {
  numberedPartsCount,
  reinforcementWordIdsForPart,
  reviewWordIds,
  wordIdsForPart,
} from '../shared/topicParts'

// Saved via SettingsPage.vue (default 'pt-en'), read once per mount — same
// as ensureUserEmail's "resolve once, reuse for the session" idiom.
const LANG = getLangPair()
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
// This part's own new words — the only ones that go through the word-intro
// pages 1/2/3 (buildPartFlowSequence). `words` below is the wider pool the
// Reading/Listen-and-write review steps draw from (this part's new words
// plus its reinforcement words) — reviewing already-known words doesn't
// belong in the intro pages, only in these two review-style steps.
const newWords = ref([])
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
  router.push('/home')
}

function next() {
  if (stepIndex.value < sequence.value.length - 1) stepIndex.value++
}

const isLastStep = computed(() => sequence.value.length > 0 && stepIndex.value === sequence.value.length - 1)

// The bottom bar's Next is never gated — page 3 (type the word) used to lock
// it until the Check button confirmed a correct answer, but that blocked
// moving on from a word the learner was stuck on. Check still records
// right/wrong, it just no longer holds the flow hostage.
const isBottomBarDisabled = computed(() => false)

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
  const partParam = route.params.partNumber
  const count = numberedPartsCount(topic.value)
  // partsForTopic's index = partNumber - 1 for numbered parts (0-based), so
  // the next numbered part's index equals the current (1-based) partNumber.
  // If this was the last numbered part, fall through to whatever comes next
  // in that same accordion list at index `count` — the Review part when
  // HomePage inserted one (leftover reinforcement words), otherwise "Read
  // and Understand" directly, since HomePage only adds Review conditionally.
  // Finishing Review itself (partParam === 'review') always advances one
  // further, to "Read and Understand" at index `count + 1`.
  const nextPartIndex = partParam === 'review'
    ? count + 1
    : Number(partParam) < count ? Number(partParam) : count
  requestHomeExpansion({ topicId, partIndex: nextPartIndex })
  router.push('/home')
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

const readingWordCue = computed(() => currentReadingWord.value?.cue || '')

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

// ---- Load the topic + this part's new words, plus its share of the
// topic's reinforcement words (2 per numbered part, or every leftover word
// for the dedicated "review" part — see shared/topicParts.ts), then
// shuffle. Reinforcement words never go through the word-intro pages 1/2/3
// (they're already known) — they only widen the Reading/Listen-and-write
// review pool alongside this part's own new words. ----

async function load() {
  isLoading.value = true
  try {
    const email = ensureUserEmail()
    const topicId = route.params.topicId
    const partParam = route.params.partNumber
    const isReview = partParam === 'review'

    const [chaptersData, wordsData] = await Promise.all([
      getChapters(email, LANG),
      getWords(LANG),
    ])

    let foundTopic = null
    let foundChapterNumber = null
    for (const chapter of chaptersData.chapters || []) {
      foundTopic = chapter.topics.find((t) => t.topic_id === topicId)
      if (foundTopic) { foundChapterNumber = chapter.number; break }
    }
    topic.value = foundTopic || null
    if (!foundTopic) return

    const reinforcementIds = await getReinforcementWords(LANG, foundChapterNumber, foundTopic.number)
    const newWordIds = isReview ? [] : wordIdsForPart(foundTopic, Number(partParam))
    const reinforceWordIds = isReview
      ? reviewWordIds(foundTopic, reinforcementIds)
      : reinforcementWordIdsForPart(reinforcementIds, Number(partParam))

    const byId = {}
    for (const word of wordsData.words || []) byId[word.word_id] = word
    newWords.value = newWordIds.map((id) => byId[id]).filter(Boolean)
    const reinforceWords = reinforceWordIds.map((id) => byId[id]).filter(Boolean)
    words.value = [...newWords.value, ...reinforceWords]

    sequence.value = buildPartFlowSequence(newWords.value)
    stepIndex.value = 0
  } finally {
    isLoading.value = false
  }
}

// body's global padding (App.vue) exists for the normal centered-card pages
// — this is a full-bleed, fixed-top/bottom-bar page instead, so that padding
// would add extra height on top of .flow-page's own viewport-height layout
// and force a scrollbar with blank space at the bottom. Suppressed only
// while mounted.
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
  /* App.vue's global `body { min-height: 100vh }` still applies here since
     this class only zeroes padding — and plain 100vh is the *largest*
     mobile viewport (toolbar collapsed), so on a real device with the
     toolbar showing, the body itself stays taller than what's visible,
     making the whole page scrollable even once .flow-page's own content
     fits (see its 100dvh comment above). Override min-height too, with a
     100dvh line last so it wins over the inherited 100vh where supported. */
  min-height: 100vh;
  min-height: 100dvh;
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
  margin-top: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* A bounded height (not min-height:100vh) so this box's size never depends
     on sub-pixel rounding of vh vs. this page's own fixed-position top/bottom
     bars — that mismatch was exactly what made the body gain an unwanted
     scrollbar in Chrome (Firefox rounds it away) even though the visible
     content always fits between the two bars. Content taller than this box
     (a rare tall image on a very short/landscape viewport) now scrolls
     *inside* .flow-page itself, staying clear of the fixed bars, instead of
     scrolling the whole body — which previously let content drift half-
     hidden underneath the fixed top/bottom bars, since position:fixed
     elements don't move with a body-level scroll.

     100vh alone is wrong on real mobile browsers: it's defined as the
     *largest* viewport (toolbar collapsed), so while the address bar is
     showing, 100vh overshoots the actually-visible height by the toolbar's
     size — this box (and its overflow-y) ends up taller than what's on
     screen, so a scrollbar/scroll gap appears even though content fits.
     Desktop browsers and devtools device-emulation don't simulate that
     dynamic toolbar resize, so the bug only shows up on a real device.
     100dvh tracks the *current* visible viewport instead; keep the 100vh
     line first as a fallback for browsers without dvh support. */
  height: calc(100vh - 112px);
  height: calc(100dvh - 112px);
  overflow-y: auto;
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

.placeholder-page {
  color: var(--muted);
  font-size: 16px;
  text-align: center;
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
