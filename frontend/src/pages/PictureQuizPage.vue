<template>
  <div class="picture-quiz-page">
    <h1 class="picture-quiz-title">Picture Quiz</h1>
    <p class="picture-quiz-subtitle">Pick the word that matches the picture.</p>

    <div class="flow-loading" v-if="isLoading">
      <div class="flow-spinner"></div>
    </div>
    <p class="picture-quiz-error" v-else-if="error">Couldn't load the word list ({{ error }}).</p>

    <Quiz ref="quizRef" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Quiz from '../features/quiz/Quiz.vue'
import { getWords } from '../shared/api'
import { getLangPair } from '../shared/languagePreference'

const quizRef = ref(null)
const isLoading = ref(true)
const error = ref('')

// Quiz.vue's root panel starts hidden (display:none) since LibraryPage.vue
// normally owns toggling it per-tab — same "find the panel, show it" step
// ListenIdentifyPage.vue/PartFlowPage.vue do for their own feature
// components when they're the page's only content, not one tab among many.
onMounted(async () => {
  try {
    const data = await getWords(getLangPair())
    const panel = document.getElementById('topic-quiz-panel')
    if (panel) panel.style.display = 'flex'
    quizRef.value?.showCatalog(data.words || [])
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'unknown error'
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  quizRef.value?.pause()
})
</script>

<style scoped>
.picture-quiz-page {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.picture-quiz-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  align-self: flex-start;
}

.picture-quiz-subtitle {
  margin: 0 0 4px;
  font-size: 14px;
  color: var(--muted);
  align-self: flex-start;
}

.picture-quiz-error {
  color: var(--muted);
  text-align: center;
}

.flow-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.flow-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: picture-quiz-spin 0.8s linear infinite;
}

@keyframes picture-quiz-spin {
  to { transform: rotate(360deg); }
}
</style>
