<template>
  <div class="word-page-1">
    <WordVisual :image-ok="imageOk" :image-url="imageUrl" :cue="cue" @image-error="$emit('image-error')" />

    <div class="word-page-1-word-block">
      <div class="word-page-1-word-row">
        <span class="word-page-1-word">{{ word }}</span>
        <AudioButton @click="$emit('play-audio')" />
      </div>
      <div class="word-page-1-pinyin" v-if="pinyin">{{ pinyin }}</div>
    </div>

    <AuxiliarSentence :sentence="auxiliarSentence" />
  </div>
</template>

<script setup>
import AudioButton from './AudioButton.vue'
import AuxiliarSentence from './AuxiliarSentence.vue'
import WordVisual from './WordVisual.vue'

defineProps({
  imageOk: { type: Boolean, default: false },
  imageUrl: { type: String, default: '' },
  cue: { type: String, default: '' },
  word: { type: String, default: '' },
  pinyin: { type: String, default: '' },
  auxiliarSentence: { type: String, default: '' },
})

defineEmits(['image-error', 'play-audio'])
</script>

<style scoped>
.word-page-1 {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.word-page-1-word-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 24px;
}

.word-page-1-word-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.word-page-1-word {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
}

.word-page-1-pinyin {
  font-size: 16px;
  font-weight: 400;
  margin-top: 14px;
  color: var(--muted);
}
</style>
