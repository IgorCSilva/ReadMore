<template>
  <div class="word-page-3">
    <WordVisual :image-ok="imageOk" :image-url="imageUrl" :cue="cue" @image-error="$emit('image-error')" />

    <div class="word-page-3-input-row">
      <input
        type="text"
        class="word-page-3-input"
        :class="{ success: writeState === 'success' }"
        :value="writtenText"
        :disabled="writeState === 'success'"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        @input="$emit('update:writtenText', $event.target.value)"
        @keydown.enter.prevent="$emit('check')"
      />
      <AudioButton @click="$emit('play-audio')" />
    </div>

    <div class="word-page-3-result" v-if="writeState !== 'idle'">
      <span
        v-for="(op, opIndex) in writeDiff"
        :key="opIndex"
        :class="`word-page-3-letter-${op.type}`"
      >{{ op.type !== 'correct' && op.char === ' ' ? '␣' : op.char }}</span>
    </div>

    <button
      type="button"
      class="word-page-3-check-btn"
      :disabled="writeState === 'success'"
      @click="$emit('check')"
      aria-label="Check answer"
    >
      ✓
    </button>
  </div>
</template>

<script setup>
import AudioButton from './AudioButton.vue'
import WordVisual from './WordVisual.vue'

defineProps({
  imageOk: { type: Boolean, default: false },
  imageUrl: { type: String, default: '' },
  cue: { type: String, default: '' },
  writtenText: { type: String, default: '' },
  writeState: { type: String, default: 'idle' },
  writeDiff: { type: Array, default: () => [] },
})

defineEmits(['image-error', 'play-audio', 'check', 'update:writtenText'])
</script>

<style scoped>
.word-page-3 {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.word-page-3-input-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.word-page-3-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  color: var(--text);
  border: none;
  border-bottom: 2px solid var(--border);
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  font-family: inherit;
  padding: 6px 4px;
}

.word-page-3-input:focus {
  outline: none;
  border-bottom-color: var(--accent);
}

.word-page-3-input.success {
  border-bottom-color: var(--accent);
  color: var(--accent);
}

.word-page-3-result {
  display: flex;
  align-items: baseline;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1px;
  font-size: 22px;
  font-weight: 700;
}

.word-page-3-letter-correct,
.word-page-3-letter-missing,
.word-page-3-letter-wrong {
  display: inline-block;
  white-space: pre;
}

.word-page-3-letter-correct {
  color: var(--accent);
}

.word-page-3-letter-missing {
  color: var(--muted);
  opacity: 0.5;
}

.word-page-3-letter-wrong {
  color: #e0453a;
  font-size: 0.7em;
}

.word-page-3-check-btn {
  align-self: flex-end;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
}

.word-page-3-check-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.word-page-3-check-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
