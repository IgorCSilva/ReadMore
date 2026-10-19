<template>
  <div class="stories-page">
    <h1 class="stories-title">Stories</h1>

    <div class="stories-loading" v-if="isLoading">
      <div class="stories-spinner"></div>
    </div>

    <p class="stories-error" v-else-if="error">Couldn't load stories ({{ error }}).</p>

    <div class="level-group" v-else v-for="level in LEVELS" :key="level">
      <div class="level-heading">{{ level }}</div>

      <p class="level-empty" v-if="!storiesByLevel[level]?.length">No stories yet.</p>

      <RouterLink
        v-for="story in storiesByLevel[level]"
        :key="story.story_id"
        :to="{ name: 'story-reader', params: { level: level.toLowerCase(), storyId: story.story_id } }"
        class="story-card"
      >
        {{ story.title }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getStories } from '../shared/api'
import { getLangPair } from '../shared/languagePreference'
import type { StorySummary } from '../shared/types'

// Fixed CEFR order, independent of whatever order /stories happens to
// return — every level gets its own section even with zero stories yet
// ("listed by level, A1 to C2" implies the ladder itself is always
// visible), rather than only showing levels that already have content.
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const isLoading = ref(true)
const error = ref('')
const stories = ref<StorySummary[]>([])

const storiesByLevel = computed(() => {
  const grouped: Record<string, StorySummary[]> = {}
  for (const story of stories.value) {
    ;(grouped[story.level] ??= []).push(story)
  }
  return grouped
})

onMounted(async () => {
  try {
    const data = await getStories(getLangPair())
    stories.value = data.stories || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'unknown error'
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.stories-page {
  width: 100%;
  max-width: 640px;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stories-title {
  margin: 0;
  font-size: 20px;
}

.stories-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.stories-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: stories-spin 0.8s linear infinite;
}

@keyframes stories-spin {
  to { transform: rotate(360deg); }
}

.stories-error {
  color: var(--muted);
  text-align: center;
}

.level-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.level-heading {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.level-empty {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}

.story-card {
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

.story-card:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
