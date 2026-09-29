<template>
  <div class="word-page-1-cue-big" v-if="big">{{ cue }}</div>
  <div class="word-page-1-cue" v-else>{{ cue }}</div>
</template>

<script setup>
defineProps({
  cue: { type: String, default: '' },
  big: { type: Boolean, default: false },
})
</script>

<style scoped>
.word-page-1-cue-big {
  font-size: clamp(24px, 6vw, 40px);
  font-weight: 700;
  text-align: center;
  color: var(--text);
}

.word-page-1-cue {
  font-size: 16px;
  color: var(--muted);
  text-align: center;
}
</style>
