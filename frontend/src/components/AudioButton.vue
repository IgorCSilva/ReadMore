<template>
  <button type="button" class="word-page-1-audio-btn" @click="$emit('click')" aria-label="Play audio">🔊</button>
</template>

<script setup>
defineEmits(['click'])
</script>

<style scoped>
.word-page-1-audio-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}

.word-page-1-audio-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
