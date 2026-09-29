<template>
  <AuxiliarSentence :sentence="auxiliarSentence" />

  <div class="word-actions">
    <button
      type="button"
      class="word-actions-audio-btn"
      aria-label="Play audio"
      @click="$emit('play-audio')"
    >
      🔊
    </button>
    <button
      v-if="cue"
      type="button"
      class="word-actions-audio-btn"
      aria-label="Show cue"
      @click="cueVisible = !cueVisible"
    >
      💡
    </button>
  </div>

  <WordCue v-if="cueVisible && cue" :cue="cue" />
</template>

<script setup>
// Shared with TargetWordBalloon.vue (inside its Teleport/popover) and
// ReadingPage.vue (rendered inline, no positioning) — auxiliar sentence is
// opt-in per caller: AuxiliarSentence self-hides when no sentence is passed,
// so ReadingPage (which has no auxiliar sentence data) simply omits the prop.
import { ref, watch } from 'vue'
import AuxiliarSentence from './AuxiliarSentence.vue'
import WordCue from './WordCue.vue'

const props = defineProps({
  auxiliarSentence: { type: String, default: '' },
  cue: { type: String, default: '' },
})

defineEmits(['play-audio'])

const cueVisible = ref(false)

// Collapses a revealed cue when the underlying word changes, mirroring
// TargetWordBalloon's former per-word reset in showFor()/hide().
watch(() => [props.auxiliarSentence, props.cue], () => {
  cueVisible.value = false
})
</script>

<style scoped>
.word-actions {
  display: flex;
  align-items: center;
  gap: 22px;
}
.word-actions-audio-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border: none; border-radius: 50%;
  background: var(--accent-soft); color: var(--accent-strong);
  font-size: 15px; cursor: pointer;
}
.word-actions-audio-btn:hover {
  background: var(--accent); color: #fff;
}
</style>
