<template>
  <div class="learning-page">
    <h1 class="learning-title">Learning</h1>

    <div class="learning-loading" v-if="isLoading">
      <div class="learning-spinner"></div>
    </div>

    <p class="learning-error" v-else-if="error">Couldn't load content ({{ error }}).</p>

    <p class="learning-empty" v-else-if="themes.length === 0">No content yet.</p>

    <div class="theme-group" v-else v-for="theme in themes" :key="theme">
      <div class="theme-heading">{{ formatTheme(theme) }}</div>

      <RouterLink
        v-for="topic in topicsByTheme[theme]"
        :key="topic.topic_id"
        :to="{ name: 'learning-topic', params: { theme, topicId: topic.topic_id } }"
        class="topic-card"
      >
        {{ topicLabel(topic) }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getLearningTopics } from '../shared/api'
import { getLangPair } from '../shared/languagePreference'
import type { LearningTopicSummary } from '../shared/types'

const isLoading = ref(true)
const error = ref('')
const topics = ref<LearningTopicSummary[]>([])

const topicsByTheme = computed(() => {
  const grouped: Record<string, LearningTopicSummary[]> = {}
  for (const topic of topics.value) {
    ;(grouped[topic.theme] ??= []).push(topic)
  }
  return grouped
})

// Only themes that actually have content show up — unlike StoriesPage's
// fixed CEFR ladder, there's no fixed universe of themes to pre-list.
const themes = computed(() => Object.keys(topicsByTheme.value).sort())

function formatTheme(theme: string): string {
  return theme.charAt(0).toUpperCase() + theme.slice(1)
}

function topicLabel(topic: LearningTopicSummary): string {
  return `(${topic.level}) ${topic.title}`
}

onMounted(async () => {
  try {
    // Resolved from the user's language pair, same idiom as
    // StoryReaderPage's targetCode — this content is plain target-language
    // reading, keyed by the bare target code rather than the full pair.
    const targetCode = getLangPair().split('-')[1] || 'en'
    const data = await getLearningTopics(targetCode)
    topics.value = data.topics || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'unknown error'
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.learning-page {
  width: 100%;
  max-width: 640px;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.learning-title {
  margin: 0;
  font-size: 20px;
}

.learning-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.learning-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: learning-spin 0.8s linear infinite;
}

@keyframes learning-spin {
  to { transform: rotate(360deg); }
}

.learning-error,
.learning-empty {
  color: var(--muted);
  text-align: center;
}

.theme-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-heading {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.topic-card {
  display: block;
  width: 100%;
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 15px 18px;
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
}

.topic-card:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
