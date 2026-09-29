<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="popoverEl"
      class="target-word-balloon"
      :style="{ top: `${top}px`, left: `${left}px` }"
      @click.stop
    >
      <WordActions :auxiliar-sentence="auxiliarSentence" :cue="cue" @play-audio="playAudio" />
    </div>
  </Teleport>
</template>

<script setup>
// Two-tier TTS strategy shared with PartFlowPage.vue's playAudio/speakLocal:
// try the backend /tts proxy, falling back to the browser's speechSynthesis
// on error/rejected play. Reusable balloon for "click a target word, hear
// it read aloud (and optionally see its auxiliar sentence / cue)" across any
// word list.

import { nextTick, onUnmounted, ref } from 'vue'
import { ttsUrl } from '../shared/api'
import { speechLocaleFor } from '../shared/languages'
import WordActions from './WordActions.vue'

const visible = ref(false)
const popoverEl = ref(null)
const top = ref(0)
const left = ref(0)
const cue = ref('')
const auxiliarSentence = ref('')
let word = ''
let langCode = 'en'

function hide() {
  visible.value = false
}

async function showFor(anchorEl, { word: text, lang, cue: cueText, auxiliarSentence: auxSentence } = {}) {
  word = text || ''
  langCode = lang || 'en'
  cue.value = cueText || ''
  auxiliarSentence.value = auxSentence || ''
  visible.value = true
  await nextTick()

  const rect = anchorEl.getBoundingClientRect()
  const popoverRect = popoverEl.value.getBoundingClientRect()
  const fitsAbove = rect.top >= popoverRect.height + 8
  top.value = fitsAbove ? rect.top - popoverRect.height - 8 : rect.bottom + 8
  left.value = Math.max(
    8,
    Math.min(rect.left + rect.width / 2 - popoverRect.width / 2, window.innerWidth - popoverRect.width - 8)
  )
}

function speakLocal(text, lang) {
  if (!('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = speechLocaleFor(lang)
  window.speechSynthesis.speak(utterance)
}

function playAudio() {
  if (!word) return
  const audio = new Audio(ttsUrl(word, langCode))
  audio.addEventListener('error', () => speakLocal(word, langCode))
  audio.play().catch(() => speakLocal(word, langCode))
}

function handleOutsideClick(event) {
  if (!visible.value) return
  if (popoverEl.value?.contains(event.target)) return
  hide()
}

document.addEventListener('click', handleOutsideClick)
window.addEventListener('scroll', hide, true)

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  window.removeEventListener('scroll', hide, true)
})

defineExpose({ showFor, hide })
</script>

<style scoped>
.target-word-balloon {
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--card); color: var(--text);
  border: 1px solid var(--border); border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.25);
  z-index: 200;
}
</style>
