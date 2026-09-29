<template>
  <div class="reading-page">
    <div class="reading-page-counter" v-if="total">
      {{ index + 1 }} / {{ total }}
    </div>

    <button type="button" class="reading-page-card" @click="$emit('next')">
      <span class="reading-page-word" :style="{ color: wordColor }">{{ wordText }}</span>
    </button>

    <div class="reading-page-hint">Tap the word for the next one</div>

    <WordActions :cue="cue" @play-audio="$emit('play-audio')" />

    <div class="reading-page-controls">
      <button
        type="button"
        class="reading-page-autopass-btn"
        :class="{ pressed: autoPass }"
        @click="$emit('toggle-auto-pass')"
      >
        Auto-pass
      </button>

      <div class="reading-page-velocity">
        <label for="reading-page-velocity-range">Speed</label>
        <input
          id="reading-page-velocity-range"
          type="range"
          min="1"
          :max="velocityMax"
          :value="velocity"
          @input="$emit('update:velocity', Number($event.target.value))"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import WordActions from './WordActions.vue'

defineProps({
  index: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  wordText: { type: String, default: '' },
  wordColor: { type: String, default: '' },
  cue: { type: String, default: '' },
  autoPass: { type: Boolean, default: false },
  velocity: { type: Number, default: 1 },
  velocityMax: { type: Number, default: 10 },
})

defineEmits(['next', 'toggle-auto-pass', 'update:velocity', 'play-audio'])
</script>

<style scoped>
.reading-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.reading-page-counter {
  font-size: 14px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.reading-page-card {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 360px;
  min-height: 180px;
  padding: 32px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.reading-page-card:hover {
  border-color: var(--accent);
}

.reading-page-word {
  font-size: clamp(28px, 7vw, 48px);
  font-weight: 800;
  text-align: center;
  word-break: break-word;
  color: var(--text);
}

.reading-page-hint {
  font-size: 13px;
  color: var(--muted);
}

.reading-page-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.reading-page-autopass-btn {
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.reading-page-autopass-btn:hover {
  border-color: var(--accent);
}

.reading-page-autopass-btn.pressed {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.reading-page-velocity {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}
</style>
