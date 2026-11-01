<template>
  <div class="learning-page">
    <h1 class="learning-title">Learning</h1>

    <div class="learning-loading" v-if="isLoading">
      <div class="learning-spinner"></div>
    </div>

    <p class="learning-error" v-else-if="error">Couldn't load content ({{ error }}).</p>

    <p class="learning-empty" v-else-if="themes.length === 0">No content yet.</p>

    <div class="theme-group" v-else v-for="theme in themes" :key="theme">
      <div class="theme-heading">{{ themeLabel(theme) }}</div>

      <div class="topic-group" v-for="group in topicGroupsByTheme[theme]" :key="group.label">
        <div class="topic-group-heading" v-if="group.label">{{ group.label }}</div>

        <RouterLink
          v-for="topic in group.topics"
          :key="topic.topic_id"
          :to="{ name: 'learning-topic', params: { theme, topicId: topic.topic_id } }"
          class="topic-card"
        >
          {{ topicLabel(topic) }}
        </RouterLink>
      </div>
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

// Every topic in a theme shares the same theme_label (it's the same
// content tree's own "theme" field), so the first topic's value stands in
// for the whole group. Falls back to the routing key itself if a theme
// somehow has no topics (shouldn't happen, themes is derived from them).
function themeLabel(theme: string): string {
  return topicsByTheme.value[theme]?.[0]?.theme_label || theme
}

// Sub-groups each theme's topics by topic_group (e.g. "Nutrición" vs.
// "Ejercicio físico" within "Salud"), sorted alphabetically by label so the
// order is stable regardless of glob/filesystem order. A topic with no
// topic_group (content not yet carrying that field) lands in a labelless
// group, rendered without a subheading rather than an empty one.
const topicGroupsByTheme = computed(() => {
  const result: Record<string, { label: string; topics: LearningTopicSummary[] }[]> = {}
  for (const theme of themes.value) {
    const byGroup: Record<string, LearningTopicSummary[]> = {}
    for (const topic of topicsByTheme.value[theme]) {
      ;(byGroup[topic.topic_group] ??= []).push(topic)
    }
    result[theme] = Object.keys(byGroup)
      .sort()
      .map((label) => ({ label, topics: byGroup[label] }))
  }
  return result
})

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
  gap: 14px;
}

.theme-heading {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.topic-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.topic-group-heading {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  opacity: 0.75;
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
