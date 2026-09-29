<template>
  <div class="word-page-2">
    <div class="word-page-2-word-wrap">
      <div class="word-page-2-word">{{ word }}</div>
      <div class="word-page-2-pinyin" v-if="pinyin">{{ pinyin }}</div>
    </div>

    <div class="word-page-2-controls">
      <button
        type="button"
        class="word-page-2-mic-btn"
        :disabled="speechState === 'listening' || !speechSupported"
        @click="$emit('start-listening')"
        aria-label="Record your voice"
      >
        🎤
      </button>

      <div class="word-page-2-wave" v-if="speechState === 'listening'">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="word-page-2-result success" v-else-if="speechState === 'success'">
        ✓ Correct!
      </div>
      <div class="word-page-2-result failure" v-else-if="speechState === 'failure'">
        Not quite — try saying it again.
      </div>
      <div class="word-page-2-hint" v-else-if="speechState === 'unsupported'">
        Voice recognition isn't supported in this browser.
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  word: { type: String, default: '' },
  pinyin: { type: String, default: '' },
  speechState: { type: String, default: 'idle' },
  speechSupported: { type: Boolean, default: false },
})

defineEmits(['start-listening'])
</script>

<style scoped>
.word-page-2 {
  position: relative;
  width: 100%;
  flex: 1;
  align-self: stretch;
}

.word-page-2-word-wrap {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.word-page-2-word {
  font-size: clamp(28px, 7vw, 44px);
  font-weight: 700;
  text-align: center;
  color: var(--text);
}

.word-page-2-pinyin {
  font-size: 16px;
  font-weight: 400;
  color: var(--muted);
}

.word-page-2-controls {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: 100%;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.word-page-2-mic-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 40px;
  line-height: 1;
  cursor: pointer;
  margin-bottom: 46px;
}

.word-page-2-mic-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.word-page-2-mic-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.word-page-2-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
}

.word-page-2-wave span {
  width: 5px;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  animation: word-page-2-wave-bounce 0.9s ease-in-out infinite;
}

.word-page-2-wave span:nth-child(2) { animation-delay: 0.1s; }
.word-page-2-wave span:nth-child(3) { animation-delay: 0.2s; }
.word-page-2-wave span:nth-child(4) { animation-delay: 0.3s; }
.word-page-2-wave span:nth-child(5) { animation-delay: 0.4s; }

@keyframes word-page-2-wave-bounce {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}

.word-page-2-result {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.word-page-2-result.success {
  color: var(--accent);
}

.word-page-2-result.failure {
  color: #d33;
}

.word-page-2-hint {
  font-size: 14px;
  color: var(--muted);
  text-align: center;
}
</style>
