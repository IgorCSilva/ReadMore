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

    <!-- Page 2/3, Reading, and Listen-and-write aren't designed yet — placeholders
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
  if (step?.kind === 'word' && step.pageNumber === 1) {
    startImageLoad(step.word.filename)
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
