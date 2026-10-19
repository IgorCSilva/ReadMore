<template>
  <div class="flow-topbar">
    <button type="button" class="flow-exit-btn" @click="exit" aria-label="Exit">✕</button>
  </div>

  <div class="reader-page">
    <div class="flow-loading" v-if="isLoading">
      <div class="flow-spinner"></div>
    </div>

    <template v-else-if="story">
      <h1 class="reader-title">{{ story.title }}</h1>

      <div class="reader-text">
        <template v-for="(line, index) in story.sentences" :key="index">
          <div class="reader-blank" v-if="line === ''"></div>
          <button
            type="button"
            class="reader-line"
            :class="{ active: index === currentIndex }"
            v-else
            @click="selectSentence(index)"
          >
            {{ line }}
          </button>
        </template>
      </div>
    </template>
  </div>

  <div class="flow-bottombar reader-controls" v-if="story">
    <button type="button" class="reader-speed-btn" @click="cycleSpeed" aria-label="Playback speed">
      {{ speed }}x
    </button>
    <button type="button" class="reader-control-btn" @click="togglePlayPause" :aria-label="playing ? 'Pause' : 'Play'">
      {{ playing ? '⏸' : '▶' }}
    </button>
    <button type="button" class="reader-control-btn" @click="stop" aria-label="Stop">⏹</button>
    <button type="button" class="reader-study-btn" @click="openStudy">Study</button>
  </div>

  <StudyWordModal
    v-if="studyOpen && story"
    :sentence="currentSentenceText"
    :glossary="story.glossary"
    :target-lang-code="targetCode"
    @close="closeStudy"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StudyWordModal from '../features/stories/StudyWordModal.vue'
import { getStory, ttsUrl } from '../shared/api'
import { getLangPair } from '../shared/languagePreference'
import { speechLocaleFor } from '../shared/languages'
import type { Story } from '../shared/types'

// Saved via SettingsPage.vue (default 'pt-en'), resolved once per mount —
// same idiom as PartFlowPage/ReadUnderstandPage.
const LANG = getLangPair()
const targetCode = LANG.split('-')[1] || LANG

const route = useRoute()
const router = useRouter()

const story = ref<Story | null>(null)
const isLoading = ref(true)
const currentIndex = ref(0)
const playing = ref(false)
const studyOpen = ref(false)

// 1x is the middle default, same idea as a physical dial's center detent —
// cycling wraps around rather than clamping at either end.
const SPEEDS = [0.5, 0.75, 1, 1.25]
const speedIndex = ref(SPEEDS.indexOf(1))
const speed = computed(() => SPEEDS[speedIndex.value])

function cycleSpeed(): void {
  speedIndex.value = (speedIndex.value + 1) % SPEEDS.length
  // Applies live to whatever's already playing/paused, not just the next
  // playFrom() call — same as any media player's speed control.
  if (liveAudio) liveAudio.playbackRate = speed.value
}

// Not reactive on purpose — same idiom as Phrases.vue's module-level
// currentAudio: holding the live HTMLAudioElement in a ref would just
// trigger pointless re-renders on every timeupdate.
let liveAudio: HTMLAudioElement | null = null

const currentSentenceText = computed(() => story.value?.sentences[currentIndex.value] ?? '')

function nextPlayableIndex(from: number): number | null {
  const sentences = story.value?.sentences ?? []
  for (let i = from + 1; i < sentences.length; i++) {
    if (sentences[i] !== '') return i
  }
  return null
}

function firstPlayableIndex(): number {
  const sentences = story.value?.sentences ?? []
  const index = sentences.findIndex((s) => s !== '')
  return index === -1 ? 0 : index
}

// Two-tier TTS strategy shared with PartFlowPage.vue/Phrases.vue's
// playAudio/speakLocal: try the backend /tts proxy, fall back to the
// browser's speechSynthesis on error/rejected play — `onDone` fires either
// way so whole-text playback keeps advancing through the fallback path too.
function speakLocalAndThen(text: string, onDone: () => void): void {
  if (!('speechSynthesis' in window) || !text) {
    onDone()
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = speechLocaleFor(targetCode)
  utterance.rate = speed.value
  utterance.onend = onDone
  window.speechSynthesis.speak(utterance)
}

function discardLiveAudio(): void {
  liveAudio?.pause()
  liveAudio = null
  window.speechSynthesis?.cancel()
}

// Plays sentence `i` through to the end of the story, one TTS request per
// line, advancing currentIndex (and so the highlight) as each line ends —
// this is "play the whole text" when started from the first line, and "play
// this sentence" followed by whatever comes after it when started mid-text,
// per the spec's "clicking a sentence highlights it, then pressing play
// reads this sentence from the beginning."
function playFrom(i: number): void {
  const sentences = story.value?.sentences ?? []
  const text = sentences[i]
  if (text === undefined) return

  currentIndex.value = i
  discardLiveAudio()
  playing.value = true

  const audio = new Audio(ttsUrl(text, targetCode))
  audio.playbackRate = speed.value
  liveAudio = audio

  const advance = () => {
    if (liveAudio !== audio) return // superseded by a newer play/stop/select
    const next = nextPlayableIndex(i)
    if (next === null) {
      playing.value = false
      liveAudio = null
      return
    }
    playFrom(next)
  }

  audio.addEventListener('ended', advance)
  audio.addEventListener('error', () => speakLocalAndThen(text, advance))
  Promise.resolve(audio.play()).catch(() => speakLocalAndThen(text, advance))
}

function togglePlayPause(): void {
  if (playing.value) {
    liveAudio?.pause()
    window.speechSynthesis?.cancel()
    playing.value = false
    return
  }
  if (liveAudio && !liveAudio.ended) {
    playing.value = true
    liveAudio.play()
    return
  }
  playFrom(currentIndex.value)
}

function stop(): void {
  discardLiveAudio()
  playing.value = false
  currentIndex.value = firstPlayableIndex()
}

function selectSentence(index: number): void {
  const wasPlaying = playing.value
  discardLiveAudio()
  currentIndex.value = index
  if (wasPlaying) {
    playFrom(index)
  } else {
    playing.value = false
  }
}

function openStudy(): void {
  if (playing.value) {
    liveAudio?.pause()
    window.speechSynthesis?.cancel()
    playing.value = false
  }
  studyOpen.value = true
}

function closeStudy(): void {
  studyOpen.value = false
}

function exit(): void {
  router.push('/stories')
}

async function load(): Promise<void> {
  isLoading.value = true
  try {
    const level = String(route.params.level)
    const storyId = String(route.params.storyId)
    const data = await getStory(LANG, level, storyId)
    story.value = data.story
    currentIndex.value = firstPlayableIndex()
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

onUnmounted(() => {
  discardLiveAudio()
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
  justify-content: flex-end;
  gap: 16px;
  padding: 0 16px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  z-index: 100;
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

.reader-page {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 72px 24px 96px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100vh;
}

.flow-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 40px;
}

.flow-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: reader-spin 0.8s linear infinite;
}

@keyframes reader-spin {
  to { transform: rotate(360deg); }
}

.reader-title {
  margin: 0 0 8px;
  font-size: 20px;
  text-align: center;
}

.reader-text {
  display: flex;
  flex-direction: column;
}

.reader-blank {
  height: 14px;
}

.reader-line {
  display: block;
  width: 100%;
  background: none;
  border: none;
  border-radius: 8px;
  padding: 4px 8px;
  margin: 1px 0;
  font: inherit;
  font-size: 17px;
  line-height: 1.6;
  color: var(--text);
  text-align: start;
  cursor: pointer;
}

.reader-line.active {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
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

.reader-controls {
  gap: 14px;
}

.reader-control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
}

.reader-control-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.reader-speed-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.reader-speed-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.reader-study-btn {
  padding: 0 22px;
  height: 44px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.reader-study-btn:hover {
  background: var(--accent-strong);
}
</style>
