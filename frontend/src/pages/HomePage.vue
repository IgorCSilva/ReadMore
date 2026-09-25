<template>
  <div class="home-topbar">
    <strong>Olá, {{ currentUser.email }}</strong>
    <button type="button" class="home-logout-btn" @click="logout">Logout</button>
  </div>

  <div class="home-page">
    <div class="home-loading" v-if="isLoading">
      <div class="home-spinner"></div>
    </div>

    <div class="chapter-group" v-for="chapter in chapters" :key="chapter.chapter_id">
      <div class="chapter-heading">{{ chapter.number }}. {{ chapter.title }}</div>

      <div class="topic-card" v-for="topic in chapter.topics" :key="topic.topic_id">
        <button type="button" class="topic-card-header" @click="toggleTopic(topic.topic_id)">
          <div class="topic-card-number">{{ chapter.number }}.{{ topic.number }}</div>
          <div class="topic-card-title">{{ topic.title }}</div>
          <div class="topic-card-status" :class="`topic-card-status-${STATUS.NOT_STARTED}`">
            {{ STATUS_ICON[STATUS.NOT_STARTED] }}
          </div>
          <div class="topic-card-chevron" :class="{ expanded: expandedTopicId === topic.topic_id }">›</div>
        </button>

        <div class="topic-parts" v-if="expandedTopicId === topic.topic_id">
          <div class="part" v-for="(part, index) in partsForTopic(topic)" :key="index">
            <button type="button" class="part-header" @click="togglePart(index)">
              <span class="part-label">{{ part.label }}</span>
              <span class="part-chevron" :class="{ expanded: expandedPartIndex === index }">›</span>
            </button>

            <div class="part-body" v-if="expandedPartIndex === index">
              <div class="part-words" v-if="part.kind === 'words'">{{ wordsText(part.wordIds) }}</div>
              <button type="button" class="part-start-btn" @click="handleStart(topic, part)">Start</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getChapters, getWords } from '../shared/api'
import { cacheKey, writeCache } from '../shared/cache'
import { ensureUserEmail, getCurrentUser, logoutUser } from '../shared/currentUser'
import { readStale, refreshInBackground } from '../shared/dataSync'
import { consumeHomeExpansion } from '../shared/homeExpansion'
import { getLangPair } from '../shared/languagePreference'
import { numberedPartsCount, wordIdsForPart } from '../shared/topicParts'

// Saved via SettingsPage.vue (default 'pt-en'), read once per mount — same
// as ensureUserEmail's "resolve once, reuse for the session" idiom.
const LANG = getLangPair()

const STATUS = { FINISHED: 'finished', LEARNING: 'learning', NOT_STARTED: 'not_started' }
const STATUS_ICON = { [STATUS.FINISHED]: '✓', [STATUS.LEARNING]: '◐', [STATUS.NOT_STARTED]: '○' }

const router = useRouter()
const currentUser = getCurrentUser()
const chapters = ref([])
const wordsById = ref({})
const isLoading = ref(true)

// Accordion state: only one topic card, and within it only one part, is
// expanded at a time — collapsing the other(s) is the chosen UX (vs.
// independent toggles), so expanding a new topic always resets the part.
const expandedTopicId = ref(null)
const expandedPartIndex = ref(null)

function toggleTopic(topicId) {
  expandedTopicId.value = expandedTopicId.value === topicId ? null : topicId
  expandedPartIndex.value = null
}

function togglePart(index) {
  expandedPartIndex.value = expandedPartIndex.value === index ? null : index
}

function logout() {
  logoutUser()
  router.push('/')
}

// Splits a topic's word_ids into 5-word "Part N" chunks (via shared/topicParts,
// so this always agrees with PartFlowPage's own slice for the same part
// number), then appends the two fixed whole-topic parts (no word chunk of
// their own — they expand to just a Start button, see the template's
// part-body, and aren't wired to navigate anywhere yet).
function partsForTopic(topic) {
  const parts = []
  const count = numberedPartsCount(topic)
  for (let partNumber = 1; partNumber <= count; partNumber++) {
    parts.push({ kind: 'words', label: `Part ${partNumber}`, partNumber, wordIds: wordIdsForPart(topic, partNumber) })
  }
  parts.push({ kind: 'action', action: 'read-understand', label: 'Read and Understand' })
  parts.push({ kind: 'action', action: 'listen-identify', label: 'Listen and identify' })
  return parts
}

function wordsText(wordIds) {
  return wordIds.map((id) => wordsById.value[id]?.original).filter(Boolean).join(', ')
}

function handleStart(topic, part) {
  if (part.kind === 'words') {
    router.push({ name: 'part-flow', params: { topicId: topic.topic_id, partNumber: String(part.partNumber) } })
  } else if (part.action === 'read-understand') {
    router.push({ name: 'read-understand', params: { topicId: topic.topic_id } })
  } else if (part.action === 'listen-identify') {
    router.push({ name: 'listen-identify', params: { topicId: topic.topic_id } })
  }
}

async function loadChapters(email) {
  const key = cacheKey('chapters', email, LANG)
  const cached = readStale(key)
  if (cached) {
    chapters.value = cached.data
    refreshInBackground({
      key,
      label: 'chapters',
      fetchFn: () => getChapters(email, LANG).then((data) => data.chapters || []),
      onFresh: (data) => { chapters.value = data },
    })
    return
  }

  try {
    const data = await getChapters(email, LANG)
    chapters.value = data.chapters || []
    writeCache(key, chapters.value)
  } catch (err) {
    console.error("Couldn't load chapters", err)
  }
}

async function loadWords() {
  try {
    const data = await getWords(LANG)
    const map = {}
    for (const word of data.words || []) map[word.word_id] = word
    wordsById.value = map
  } catch (err) {
    console.error("Couldn't load words", err)
  }
}

onMounted(async () => {
  // Set once, up front: PartFlowPage requests this when finishing a part,
  // independent of the chapters/words fetch below — the accordion reads
  // these refs reactively, so it expands correctly whichever finishes first.
  const pending = consumeHomeExpansion()
  if (pending) {
    expandedTopicId.value = pending.topicId
    expandedPartIndex.value = pending.partIndex
  }

  const email = ensureUserEmail()
  try {
    await Promise.all([loadChapters(email), loadWords()])
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.home-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  color: var(--text);
  z-index: 100;
}

.home-logout-btn {
  flex-shrink: 0;
  padding: 7px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: none;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.home-logout-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.home-page {
  width: 100%;
  max-width: 900px;
  padding-top: 56px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.home-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.home-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: home-spin 0.8s linear infinite;
}

@keyframes home-spin {
  to { transform: rotate(360deg); }
}

.chapter-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chapter-heading {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.topic-card {
  width: 100%;
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}

.topic-card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  background: none;
  border: none;
  padding: 15px 18px;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.topic-card-number {
  flex-shrink: 0;
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.topic-card-title {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
}

.topic-card-status {
  flex-shrink: 0;
  font-size: 18px;
  color: var(--muted);
}

.topic-card-status-finished {
  color: var(--confident);
}

.topic-card-status-learning {
  color: var(--learning);
}

.topic-card-chevron {
  flex-shrink: 0;
  color: var(--muted);
  font-size: 13px;
  transition: transform 0.2s ease;
}

.topic-card-chevron.expanded {
  transform: rotate(90deg);
  color: var(--accent);
}

.topic-parts {
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.part {
  border-bottom: 1px solid var(--border);
}

.part:last-child {
  border-bottom: none;
}

.part-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  background: none;
  border: none;
  padding: 12px 18px 12px 36px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.part-header:hover {
  color: var(--accent);
}

.part-chevron {
  flex-shrink: 0;
  color: var(--muted);
  font-size: 12px;
  transition: transform 0.2s ease;
}

.part-chevron.expanded {
  transform: rotate(90deg);
  color: var(--accent);
}

.part-body {
  padding: 0 18px 16px 36px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.part-words {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
}

.part-start-btn {
  align-self: flex-start;
  padding: 8px 22px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.part-start-btn:hover {
  background: var(--accent-strong);
}
</style>
