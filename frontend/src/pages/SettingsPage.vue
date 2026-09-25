<template>
  <div class="settings-page">
    <h1 class="settings-title">Language</h1>

    <section class="settings-section">
      <h2 class="settings-section-title">I already speak</h2>
      <div class="lang-options">
        <button
          type="button"
          class="lang-option"
          v-for="code in originOptions"
          :key="code"
          :class="{ selected: selectedOrigin === code }"
          @click="selectOrigin(code)"
        >
          <img class="lang-option-flag" :src="flagUrl(code)" :alt="flagFor(code).country" />
          <span class="lang-option-country">{{ flagFor(code).country }}</span>
        </button>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="settings-section-title">I want to learn</h2>
      <div class="lang-options">
        <button
          type="button"
          class="lang-option"
          v-for="code in targetOptions"
          :key="code"
          :class="{ selected: selectedTarget === code }"
          @click="selectedTarget = code"
        >
          <img class="lang-option-flag" :src="flagUrl(code)" :alt="flagFor(code).country" />
          <span class="lang-option-country">{{ flagFor(code).country }}</span>
        </button>
      </div>
    </section>

    <div class="settings-actions">
      <button type="button" class="settings-save-btn" :disabled="!canSave" @click="save">Save</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getLanguages } from '../shared/api'
import { flagFor, flagUrl } from '../shared/flags'
import { getLangPair, setLangPair } from '../shared/languagePreference'
import { notify } from '../shared/notifications'

// "origin-target" pair strings, straight from the backend's own whitelist —
// the only pairs a user is ever allowed to pick (see GET /languages).
const whitelist = ref([])
const selectedOrigin = ref('')
const selectedTarget = ref('')

const originOptions = computed(() => [...new Set(whitelist.value.map((pair) => pair.split('-')[0]))])

// Only the targets actually paired with the selected origin in the
// whitelist — not every target overall, so an unavailable combination can
// never be selected in the first place.
const targetOptions = computed(() =>
  whitelist.value.filter((pair) => pair.split('-')[0] === selectedOrigin.value).map((pair) => pair.split('-')[1])
)

const canSave = computed(() =>
  !!selectedOrigin.value && whitelist.value.includes(`${selectedOrigin.value}-${selectedTarget.value}`)
)

function selectOrigin(code) {
  selectedOrigin.value = code
  const stillValid = whitelist.value.includes(`${code}-${selectedTarget.value}`)
  if (!stillValid) {
    const firstTarget = whitelist.value.find((pair) => pair.split('-')[0] === code)
    selectedTarget.value = firstTarget ? firstTarget.split('-')[1] : ''
  }
}

function save() {
  if (!canSave.value) return
  setLangPair(`${selectedOrigin.value}-${selectedTarget.value}`)
  notify('success', 'Language pair saved.')
}

onMounted(async () => {
  const data = await getLanguages()
  whitelist.value = data.languages || []

  const [storedOrigin, storedTarget] = getLangPair().split('-')
  selectedOrigin.value = originOptions.value.includes(storedOrigin) ? storedOrigin : (originOptions.value[0] || '')
  const validTargets = whitelist.value.filter((pair) => pair.split('-')[0] === selectedOrigin.value).map((pair) => pair.split('-')[1])
  selectedTarget.value = validTargets.includes(storedTarget) ? storedTarget : (validTargets[0] || '')
})
</script>

<style scoped>
.settings-page {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 28px;
}

.settings-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}

.settings-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.settings-section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.lang-options {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 12px;
}

.lang-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100px;
  padding: 14px 10px;
  border-radius: 16px;
  border: 2px solid var(--border);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
}

.lang-option.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.lang-option-flag {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.lang-option-country {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.settings-actions {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.settings-save-btn {
  padding: 10px 32px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.settings-save-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.settings-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
