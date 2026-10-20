<template>
  <div class="study-overlay" @click.self="$emit('close')">
    <div class="study-modal">
      <div class="study-header">
        <h3>Study</h3>
        <button type="button" class="study-close" aria-label="Close" @click="$emit('close')">×</button>
      </div>

      <div class="study-body" v-if="selectedEntry">
        <div class="study-word-row">
          <span class="study-word">{{ selectedDisplay }}</span>
          <AudioButton @click="playText(selectedDisplay)" />
        </div>

        <p class="study-meaning">{{ selectedEntry.meaning }}</p>

        <div class="study-section" v-if="selectedEntry.examples.length">
          <div class="study-section-label">Examples</div>
          <div class="study-list-item" v-for="example in selectedEntry.examples" :key="example">
            <span>{{ example }}</span>
            <AudioButton @click="playText(example)" />
          </div>
        </div>

        <div class="study-section" v-if="selectedEntry.synonyms.length">
          <div class="study-section-label">Synonyms</div>
          <div class="study-chips">
            <span class="study-chip" v-for="synonym in selectedEntry.synonyms" :key="synonym">
              {{ synonym }}
              <AudioButton @click="playText(synonym)" />
            </span>
          </div>
        </div>

        <div class="study-section" v-if="selectedEntry.antonyms.length">
          <div class="study-section-label">Antonyms</div>
          <div class="study-chips">
            <span class="study-chip" v-for="antonym in selectedEntry.antonyms" :key="antonym">
              {{ antonym }}
              <AudioButton @click="playText(antonym)" />
            </span>
          </div>
        </div>
      </div>

      <p class="study-hint" v-else>No definition available for this word yet.</p>

      <div class="study-word-list">
        <button
          type="button"
          class="study-word-btn"
          v-for="(token, index) in tokens"
          :key="index"
          :class="{ active: index === selectedIndex }"
          @click="selectedIndex = index"
        >
          {{ token.display }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AudioButton from '../../components/AudioButton.vue'
import { ttsUrl } from '../../shared/api'
import { speechLocaleFor } from '../../shared/languages'
import { tokenizeStoryWords } from '../../shared/text'
import type { GlossaryEntry } from '../../shared/types'

const props = defineProps<{
  sentence: string
  glossary: Record<string, GlossaryEntry>
  targetLangCode: string
}>()

const emit = defineEmits<{ close: [] }>()

const tokens = computed(() => tokenizeStoryWords(props.sentence, props.glossary))
const selectedIndex = ref(0)

const selectedDisplay = computed(() => tokens.value[selectedIndex.value]?.display ?? '')
const selectedEntry = computed(() => {
  const key = tokens.value[selectedIndex.value]?.key
  return key ? props.glossary[key] : undefined
})

// Two-tier TTS strategy shared with PartFlowPage.vue/TargetWordBalloon.vue's
// playAudio/speakLocal: try the backend /tts proxy, fall back to the
// browser's speechSynthesis on error/rejected play.
function speakLocal(text: string): void {
  if (!('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = speechLocaleFor(props.targetLangCode)
  window.speechSynthesis.speak(utterance)
}

function playText(text: string): void {
  if (!text) return
  const audio = new Audio(ttsUrl(text, props.targetLangCode))
  audio.addEventListener('error', () => speakLocal(text))
  Promise.resolve(audio.play()).catch(() => speakLocal(text))
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.study-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1000;
}

.study-modal {
  width: min(92vw, 480px);
  max-height: 85vh;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.study-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.study-header h3 {
  margin: 0;
  font-size: 15px;
}
.study-close {
  background: none;
  border: none;
  color: var(--text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.study-body {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.study-hint {
  padding: 18px 20px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.study-word-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.study-word {
  font-size: 22px;
  font-weight: 700;
}

.study-meaning {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
}

.study-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.study-section-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.study-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 14px;
}

.study-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.study-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 600;
}

.study-word-list {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  overflow-x: auto;
  white-space: nowrap;
}

.study-word-btn {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
}

.study-word-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
</style>
