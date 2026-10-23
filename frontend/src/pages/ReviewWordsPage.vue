<template>
  <div class="review-words-page">
    <div class="review-words-header">
      <h1 class="review-words-title">Review Words</h1>
      <label class="review-words-select-label">
        Words/day
        <select v-model.number="quantity" class="review-words-select">
          <option v-for="option in QUANTITY_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
    </div>

    <div class="review-words-loading" v-if="isLoading">
      <div class="review-words-spinner"></div>
    </div>

    <p class="review-words-error" v-else-if="error">Couldn't load words ({{ error }}).</p>

    <p class="review-words-empty" v-else-if="!groups.length">No words to review yet.</p>

    <div
      class="review-words-day"
      v-else
      v-for="group in groups"
      :key="group.date"
      :id="`review-day-${group.date}`"
    >
      <div class="review-words-day-heading">{{ group.date }}</div>
      <button
        type="button"
        class="review-words-word"
        v-for="word in group.words"
        :key="word.word_id"
        @click="onWordClick($event, word)"
      >{{ word.original }}</button>
    </div>

    <TargetWordBalloon ref="balloonRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import TargetWordBalloon from '../components/TargetWordBalloon.vue'
import { getWords } from '../shared/api'
import { getLangPair } from '../shared/languagePreference'
import type { Word } from '../shared/types'

// Values from 20 to 40, 5 by 5 — the select button's whole range.
const QUANTITY_OPTIONS = [20, 25, 30, 35, 40]
const DAYS_BEFORE = 3
const DAYS_AFTER = 3

const quantity = ref(QUANTITY_OPTIONS[0])
const isLoading = ref(true)
const error = ref('')
const words = ref<Word[]>([])
const balloonRef = ref<InstanceType<typeof TargetWordBalloon> | null>(null)

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getFullYear()}`
}

// Captured once at mount, not re-read per render — same "today" anchors both
// the date range below and the auto-scroll target, so they can't drift apart
// if the page happens to stay open across midnight.
const TODAY = new Date()

// 7 days ago through 3 days after today, oldest first — each slot is filled
// by the next still-unassigned chunk of `words` below, in catalog order.
function reviewDates(): string[] {
  const dates: string[] = []
  for (let offset = -DAYS_BEFORE; offset <= DAYS_AFTER; offset++) {
    const date = new Date(TODAY)
    date.setDate(date.getDate() + offset)
    dates.push(formatDate(date))
  }
  return dates
}

interface ReviewGroup {
  date: string
  words: Word[]
}

// Chunks the full target-language word list sequentially across the date
// range, `quantity` words per day — not a refetch, so changing the select
// just re-slices the same already-loaded list.
const groups = computed<ReviewGroup[]>(() => {
  const result: ReviewGroup[] = []
  reviewDates().forEach((date, index) => {
    const start = index * quantity.value
    const chunk = words.value.slice(start, start + quantity.value)
    if (chunk.length) result.push({ date, words: chunk })
  })
  return result
})

// Bare target code ("es" out of "pt-es") — same extraction TargetWordBalloon's
// callers (Sentences.vue) use, for the TTS lang and speechSynthesis fallback.
const targetLangCode = computed(() => {
  const pair = getLangPair()
  return typeof pair === 'string' ? pair.split('-')[1] : undefined
})

function onWordClick(event: MouseEvent, word: Word): void {
  // Without this, the click bubbles to document and TargetWordBalloon's own
  // outside-click listener (added the moment it mounts) sees this same
  // opening click and immediately hides what showFor() just opened — same
  // reasoning as Sentences.vue's handleListClick.
  event.stopPropagation()
  balloonRef.value?.showFor(event.currentTarget, {
    word: word.original,
    lang: targetLangCode.value || 'en',
    cue: word.cue || '',
    auxiliarSentence: word.auxiliar_sentence || '',
  })
}

onMounted(async () => {
  try {
    const data = await getWords(getLangPair())
    words.value = data.words || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'unknown error'
  } finally {
    isLoading.value = false
  }

  // Waits for the v-for'd day sections to actually exist in the DOM —
  // groups is derived from `words`, set just above, so the list only
  // renders after this point.
  await nextTick()
  document.getElementById(`review-day-${formatDate(TODAY)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
</script>

<style scoped>
.review-words-page {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.review-words-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.review-words-title {
  margin: 0;
  font-size: 20px;
}

.review-words-select-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}

.review-words-select {
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 14px;
}

.review-words-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.review-words-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: review-words-spin 0.8s linear infinite;
}

@keyframes review-words-spin {
  to { transform: rotate(360deg); }
}

.review-words-error,
.review-words-empty {
  color: var(--muted);
  text-align: center;
}

.review-words-day {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-words-day-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--muted);
}

.review-words-day-heading::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.review-words-word {
  width: 100%;
  background: var(--card);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 16px;
  font-family: inherit;
  text-align: center;
  cursor: pointer;
}

.review-words-word:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
