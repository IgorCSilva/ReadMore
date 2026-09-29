<template>
  <div
    class="word-page-1-auxiliar-sentence"
    v-if="sentence"
    v-html="rendered"
  ></div>
</template>

<script setup>
// Same **word** -> <strong> convention as features/sentences/Sentences.vue.
import { computed } from 'vue'
import { escapeHtml } from '../shared/text'

const props = defineProps({
  sentence: { type: String, default: '' },
})

const rendered = computed(() =>
  escapeHtml(props.sentence).replace(/\*\*(.+?)\*\*/g, (_, word) => `<strong>${word}</strong>`)
)
</script>

<style scoped>
.word-page-1-auxiliar-sentence {
  max-width: 320px;
  font-size: 15px;
  line-height: 1.4;
  text-align: center;
  color: var(--muted);
}

.word-page-1-auxiliar-sentence strong {
  color: var(--accent);
}
</style>
