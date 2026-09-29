<template>
  <div class="word-page-1-image-wrap" v-if="imageOk">
    <img :src="imageUrl" @error="$emit('image-error')" alt="" />
  </div>
  <WordCue :cue="cue" :big="!imageOk" />
</template>

<script setup>
// Image (or big-cue fallback) + WordCue, shared as-is between WordPage1 and
// WordPage3 — both show the same visual for the word being taught.
import WordCue from './WordCue.vue'

defineProps({
  imageOk: { type: Boolean, default: false },
  imageUrl: { type: String, default: '' },
  cue: { type: String, default: '' },
})

defineEmits(['image-error'])
</script>

<style scoped>
.word-page-1-image-wrap {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}

.word-page-1-image-wrap img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
