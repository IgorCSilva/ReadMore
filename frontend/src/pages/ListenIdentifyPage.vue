<template>
  <div class="flow-topbar">
    <div class="flow-progress">
      <div class="flow-progress-fill" :style="{ width: progressPercent + '%' }"></div>
    </div>
    <button type="button" class="flow-exit-btn" @click="exit" aria-label="Exit">✕</button>
  </div>

  <div class="flow-page">
    <div class="flow-page-content">
      <div class="flow-loading" v-if="isLoading">
        <div class="flow-spinner"></div>
      </div>

      <Phrases ref="phrasesRef" />
    </div>
  </div>

  <div class="flow-bottombar">
    <button type="button" class="flow-next-btn" @click="finish">Finish</button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Phrases from '../features/phrases/Phrases.vue'
import { getChapters } from '../shared/api'
import { ensureUserEmail } from '../shared/currentUser'
import { requestHomeExpansion } from '../shared/homeExpansion'
import { getLangPair } from '../shared/languagePreference'
import { getPosition, savePosition } from '../shared/positionMemory'

// Saved via SettingsPage.vue (default 'pt-en'), read once per mount — same
// as ensureUserEmail's "resolve once, reuse for the session" idiom.
const LANG = getLangPair()

const route = useRoute()
const router = useRouter()

const topic = ref(null)
const phrasesRef = ref(null)
const roundCurrent = ref(0)
const roundTotal = ref(0)
const isLoading = ref(true)

// Static for this mount — the page fully remounts on every navigation here,
// so there's no need to track topicId changing underneath it.
const positionKey = `listen-identify:${route.params.topicId}`

// "Listen and Identify" is the last entry in a topic's own accordion — unlike
// finishing a numbered Part or "Read and Understand", there's no next
// section within THIS topic to hand off to. Resolved once in load(), from
// the same enabled-topics list Home itself renders, so it never points at a
// topic the user can't actually see.
let nextTopicId = null

const progressPercent = computed(() => (roundTotal.value ? (roundCurrent.value / roundTotal.value) * 100 : 0))

function exit() {
  router.push('/home')
}

function finish() {
  if (nextTopicId) {
    // Index 0 is always that topic's first accordion entry — Part 1 if it
    // has numbered parts, otherwise straight to "Read and Understand" (see
    // HomePage's partsForTopic) — so this needs no numberedPartsCount check.
    requestHomeExpansion({ topicId: nextTopicId, partIndex: 0 })
  }
  router.push('/home')
}

// Phrases reshuffles its round order on every show(), so resuming at the
// same round INDEX won't necessarily replay the exact same phrase — but it
// still means leaving and coming back doesn't force the user through
// already-completed rounds again, which is what matters here.
function handleProgress(current, total) {
  roundCurrent.value = current
  roundTotal.value = total
  if (total > 0) savePosition(positionKey, current - 1)
}

async function load() {
  isLoading.value = true
  try {
    const email = ensureUserEmail()
    const topicId = route.params.topicId

    const data = await getChapters(email, LANG)
    const chapters = data.chapters || []

    const flatTopicIds = chapters.flatMap((chapter) => chapter.topics.map((t) => t.topic_id))
    const currentIndex = flatTopicIds.indexOf(topicId)
    nextTopicId = currentIndex >= 0 ? flatTopicIds[currentIndex + 1] ?? null : null

    let foundTopic = null
    for (const chapter of chapters) {
      foundTopic = chapter.topics.find((t) => t.topic_id === topicId)
      if (foundTopic) break
    }
    topic.value = foundTopic || null
    if (!foundTopic) return

    const panel = document.getElementById('topic-phrases-panel')
    if (panel) panel.style.display = 'flex'
    // No reinforcement mixing and no cross-topic chapters — same "restricted
    // to this topic's own content" choice already made for the other flow
    // pages (see PartFlowPage.vue's Reading/Listen-and-write steps).
    phrasesRef.value?.show(email, LANG, topic.value, 'target', 'origin', [], [], handleProgress, getPosition(positionKey))
  } finally {
    // Handed off to Phrases' own internal loading state (#phrases-loading)
    // from here on — its show() call above isn't awaited on purpose, so
    // this only covers the gap before the panel/Phrases exist at all.
    isLoading.value = false
  }
}

// body's global padding (App.vue) exists for the normal centered-card pages
// — this is a full-bleed, fixed-top/bottom-bar page instead, same reasoning
// as PartFlowPage.vue.
onMounted(() => {
  document.body.classList.add('part-flow-active')
  load()
})

// Same reasoning as PartFlowPage's Dictation pause: Phrases keeps a pending
// 1s auto-advance timer (and possibly playing TTS audio) until pause() is
// called — leaving mid-round must stop it explicitly. Must run in
// onBeforeUnmount, not onUnmounted: by the time onUnmounted fires, the
// <Phrases> child has already been torn down and phrasesRef.value is null.
onBeforeUnmount(() => {
  phrasesRef.value?.pause()
})

onUnmounted(() => {
  document.body.classList.remove('part-flow-active')
})
</script>

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
  min-height: 100vh;
}

/* Centers the content vertically only while it's shorter than the
   available space — auto margins collapse to 0 once it overflows, instead
   of justify-content:center's overflow-both-ways behavior, which can trap
   the top of tall content above the reachable scroll range (see
   ReadUnderstandPage.vue, where this bit a long sentence list). */
.flow-page-content {
  width: 100%;
  margin-top: auto;
  margin-bottom: auto;
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
