<template>
  <div class="flow-topbar">
    <button type="button" class="flow-exit-btn" @click="exit" aria-label="Exit">✕</button>
  </div>

  <div class="reader-page">
    <div class="flow-loading" v-if="isLoading">
      <div class="flow-spinner"></div>
    </div>

    <template v-else-if="topic">
      <h1 class="reader-title">{{ topic.title }}</h1>

      <div class="reader-text">
        <template v-for="(line, index) in parsedLines" :key="index">
          <div class="reader-blank" v-if="line.kind === 'blank'"></div>
          <button
            type="button"
            class="reader-line"
            :class="[`reader-line--${line.kind}`, { active: index === currentIndex }]"
            v-else
            @click="selectSentence(index)"
            v-html="line.html"
          ></button>
        </template>
      </div>
    </template>
  </div>

  <div class="flow-bottombar reader-controls" v-if="topic">
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
    v-if="studyOpen && topic"
    :sentence="currentSentenceText"
    :glossary="topic.glossary"
    :target-lang-code="targetCode"
    @close="closeStudy"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StudyWordModal from '../features/stories/StudyWordModal.vue'
import { getLearningTopic, ttsUrl } from '../shared/api'
import { getLangPair } from '../shared/languagePreference'
import { speechLocaleFor } from '../shared/languages'
import { parseMarkdownLine } from '../shared/markdownLine'
import type { LearningTopic } from '../shared/types'

// Saved via SettingsPage.vue (default 'pt-en'), resolved once per mount —
// same idiom as StoryReaderPage. The topic's own text is plain
// target-language reading (keyed by targetCode below), but its glossary
// overlay is pair-specific, so the full pair is what the API call needs.
const LANG = getLangPair()
const targetCode = LANG.split('-')[1] || LANG

const route = useRoute()
const router = useRouter()

const topic = ref<LearningTopic | null>(null)
const isLoading = ref(true)
const currentIndex = ref(0)
const playing = ref(false)
const studyOpen = ref(false)

// One parsed entry per topic.sentences entry, same index alignment —
// formatted HTML to display (headings sized, bullets, **bold**, no literal
// Markdown markers) plus plain text to read aloud via TTS.
const parsedLines = computed(() => (topic.value?.sentences ?? []).map(parseMarkdownLine))

// plainText already has Markdown markers stripped (see parseMarkdownLine),
// which is exactly what the Study modal's tokenizer needs — same idea as
// StoryReaderPage's currentSentenceText, just sourced from the parsed line
// instead of the raw sentence.
const currentSentenceText = computed(() => parsedLines.value[currentIndex.value]?.plainText ?? '')

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

function nextPlayableIndex(from: number): number | null {
  const lines = parsedLines.value
  for (let i = from + 1; i < lines.length; i++) {
    if (lines[i].kind !== 'blank') return i
  }
  return null
}

function firstPlayableIndex(): number {
  const lines = parsedLines.value
  const index = lines.findIndex((l) => l.kind !== 'blank')
  return index === -1 ? 0 : index
}

// Two-tier TTS strategy shared with PartFlowPage.vue/Phrases.vue/
// StoryReaderPage.vue's playAudio/speakLocal: try the backend /tts proxy,
// fall back to the browser's speechSynthesis on error/rejected play —
// `onDone` fires either way so whole-text playback keeps advancing through
// the fallback path too.
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

// Plays sentence `i` through to the end of the topic, one TTS request per
// line, advancing currentIndex (and so the highlight) as each line ends.
function playFrom(i: number): void {
  const lines = parsedLines.value
  const text = lines[i]?.plainText
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
  router.push('/learning')
}

async function load(): Promise<void> {
  isLoading.value = true
  try {
    const theme = String(route.params.theme)
    const topicId = String(route.params.topicId)
    const data = await getLearningTopic(LANG, theme, topicId)
    topic.value = data.topic
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

.reader-line--h1 {
  font-size: 22px;
  font-weight: 800;
  margin-top: 10px;
}

.reader-line--h2 {
  font-size: 19px;
  font-weight: 700;
  margin-top: 8px;
}

.reader-line--h3 {
  font-size: 17px;
  font-weight: 700;
  margin-top: 6px;
}

.reader-line--li {
  padding-left: 20px;
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
