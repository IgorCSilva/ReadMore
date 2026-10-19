<template>
  <div class="shadowing-page">
    <h1 class="shadowing-title">Shadowing</h1>

    <div class="flow-loading" v-if="isLoading">
      <div class="flow-spinner"></div>
    </div>

    <template v-else-if="!selectedTopic">
      <p class="shadowing-empty" v-if="chaptersWithTexts.length === 0">
        No shadowing texts available yet for this language pair.
      </p>
      <div class="shadowing-picker" v-else>
        <div v-for="chapter in chaptersWithTexts" :key="chapter.chapter_id" class="shadowing-chapter">
          <h2 class="shadowing-chapter-title">{{ chapter.title }}</h2>
          <button
            v-for="topic in chapter.topics"
            :key="topic.topic_id"
            type="button"
            class="shadowing-topic-item"
            @click="selectTopic(topic)"
          >
            <span class="shadowing-topic-number">{{ topic.number }}</span>
            <span class="shadowing-topic-title">{{ topic.title }}</span>
            <span class="shadowing-topic-count">{{ topic.texts.length }} texts</span>
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="shadowing-topic-topbar">
        <button type="button" class="shadowing-back-btn" @click="backToPicker" aria-label="Back to topics">←</button>
        <span class="shadowing-topic-topbar-title">{{ selectedTopic.title }}</span>
        <select class="shadowing-speed" v-model.number="speed" aria-label="Playback speed">
          <option :value="0.75">0.75×</option>
          <option :value="1">1×</option>
          <option :value="1.25">1.25×</option>
        </select>
      </div>

      <div class="shadowing-text-list">
        <div
          v-for="text in selectedTopic.texts"
          :key="text.text_id"
          class="shadowing-text-card"
          :class="{ 'is-playing': playingTextId === text.text_id }"
        >
          <button type="button" class="shadowing-text-header" @click="toggleExpand(text.text_id)">
            <span class="shadowing-text-number">{{ text.number }}</span>
            <span class="shadowing-text-title">{{ text.title }}</span>
            <span class="shadowing-text-chevron" aria-hidden="true">{{ expandedTextId === text.text_id ? '▾' : '▸' }}</span>
          </button>

          <div class="shadowing-text-body" v-if="expandedTextId === text.text_id">
            <p v-html="renderBody(text.body)"></p>
            <button type="button" class="shadowing-play-btn" @click="togglePlay(text)">
              {{ playingTextId === text.text_id ? '⏸ Pause' : '▶ Play' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getChapters, ttsUrl } from '../shared/api'
import { ensureUserEmail } from '../shared/currentUser'
import { speechLocaleFor } from '../shared/languages'
import { getLangPair } from '../shared/languagePreference'
import { escapeHtml } from '../shared/text'

// Saved via SettingsPage.vue (default 'pt-en'), read once per mount — same
// "resolve once, reuse for the session" idiom as PartFlowPage/ReadUnderstandPage.
const LANG = getLangPair()
const TARGET_LANG_CODE = LANG.split('-')[1]

const isLoading = ref(true)
const chaptersWithTexts = ref([])
const selectedTopic = ref(null)
const expandedTextId = ref(null)
const playingTextId = ref(null)
const speed = ref(1)

// Plain variable, not a ref — the Audio element itself never needs to drive
// a template re-render; playingTextId already does that.
let currentAudio = null

function renderBody(body) {
  return escapeHtml(body).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function stripMarkup(body) {
  return body.replace(/\*\*(.+?)\*\*/g, '$1')
}

function stopPlayback() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  playingTextId.value = null
}

// Mirrors PartFlowPage.vue's speakLocal fallback — used if the /tts route
// itself fails (offline, upstream hiccup), not as the primary path.
function speakLocal(text) {
  if (!('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = speechLocaleFor(TARGET_LANG_CODE)
  utterance.rate = speed.value
  window.speechSynthesis.speak(utterance)
}

function togglePlay(text) {
  if (playingTextId.value === text.text_id) {
    stopPlayback()
    return
  }
  stopPlayback()

  const plainText = stripMarkup(text.body)
  const audio = new Audio(ttsUrl(plainText, TARGET_LANG_CODE))
  audio.playbackRate = speed.value
  audio.addEventListener('ended', stopPlayback)
  audio.addEventListener('error', () => {
    stopPlayback()
    speakLocal(plainText)
  })
  currentAudio = audio
  playingTextId.value = text.text_id
  audio.play().catch(() => {
    stopPlayback()
    speakLocal(plainText)
  })
}

// Live speed changes apply to whatever's already playing, not just the
// next thing played.
watch(speed, (newSpeed) => {
  if (currentAudio) currentAudio.playbackRate = newSpeed
})

function toggleExpand(textId) {
  if (expandedTextId.value !== textId) stopPlayback()
  expandedTextId.value = expandedTextId.value === textId ? null : textId
}

function selectTopic(topic) {
  selectedTopic.value = topic
  expandedTextId.value = null
}

function backToPicker() {
  stopPlayback()
  selectedTopic.value = null
}

async function load() {
  isLoading.value = true
  try {
    const email = ensureUserEmail()
    const data = await getChapters(email, LANG)
    // Only chapters/topics that are both released and actually have
    // shadowing texts authored — same "in_development stays unreachable"
    // rule HomePage.vue's isTopicDisabled applies, since GetChapters only
    // gates by the user's enabled-topics list, never by status.
    chaptersWithTexts.value = (data.chapters || [])
      .filter((chapter) => chapter.status !== 'in_development')
      .map((chapter) => ({
        ...chapter,
        topics: chapter.topics.filter((t) => t.status !== 'in_development' && t.texts?.length > 0),
      }))
      .filter((chapter) => chapter.topics.length > 0)
  } finally {
    isLoading.value = false
  }
}

onMounted(load)
onBeforeUnmount(stopPlayback)
</script>

<style scoped>
.shadowing-page {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.shadowing-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}

.shadowing-empty {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.flow-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 24px 0;
}

.flow-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: shadowing-spin 0.8s linear infinite;
}

@keyframes shadowing-spin {
  to { transform: rotate(360deg); }
}

.shadowing-picker {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.shadowing-chapter-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--muted);
}

.shadowing-topic-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--text);
  padding: 12px 14px;
  margin-bottom: 8px;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.shadowing-topic-item:hover {
  border-color: var(--accent);
}

.shadowing-topic-number {
  flex-shrink: 0;
  color: var(--accent);
  font-weight: 700;
}

.shadowing-topic-title {
  flex: 1;
}

.shadowing-topic-count {
  flex-shrink: 0;
  color: var(--muted);
  font-size: 12px;
}

.shadowing-topic-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.shadowing-back-btn {
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

.shadowing-back-btn:hover {
  background: var(--border);
  color: var(--text);
}

.shadowing-topic-topbar-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.shadowing-speed {
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  padding: 4px 8px;
  font-size: 13px;
}

.shadowing-text-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shadowing-text-card {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--card);
  overflow: hidden;
}

.shadowing-text-card.is-playing {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.shadowing-text-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: none;
  color: var(--text);
  padding: 12px 14px;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.shadowing-text-number {
  flex-shrink: 0;
  color: var(--accent);
  font-weight: 700;
}

.shadowing-text-title {
  flex: 1;
}

.shadowing-text-body {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shadowing-text-body p {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  line-height: 1.6;
}

.shadowing-play-btn {
  align-self: flex-start;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.shadowing-play-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
