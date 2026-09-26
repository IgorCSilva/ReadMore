<template>
  <div class="settings-page">
    <h1 class="settings-title">Language</h1>

    <section class="settings-section">
      <h2 class="settings-section-title">I already speak</h2>
      <div class="settings-loading" v-if="isLoading">
        <div class="settings-spinner"></div>
      </div>
      <div class="lang-options" v-else>
        <button
          type="button"
          class="lang-option"
          v-for="code in originOptions"
          :key="code"
          :class="{ selected: selectedOrigin === code }"
          :disabled="!enabledOrigins.has(code)"
          @click="selectOrigin(code)"
        >
          <img class="lang-option-flag" :src="flagUrl(code)" :alt="flagFor(code).country" />
          <span class="lang-option-country">{{ flagFor(code).country }}</span>
        </button>
      </div>
    </section>

    <section class="settings-section">
      <h2 class="settings-section-title">I want to learn</h2>
      <div class="settings-loading" v-if="isLoading">
        <div class="settings-spinner"></div>
      </div>
      <div class="lang-options" v-else>
        <button
          type="button"
          class="lang-option"
          v-for="code in targetOptions"
          :key="code"
          :class="{ selected: selectedTarget === code }"
          :disabled="!enabledPairs.has(`${selectedOrigin}-${code}`)"
          @click="selectTarget(code)"
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
import { getLanguages, getUser } from '../shared/api'
import { cacheKey, writeCache } from '../shared/cache'
import { ensureUserEmail } from '../shared/currentUser'
import { readStale, refreshInBackground } from '../shared/dataSync'
import { flagFor, flagUrl } from '../shared/flags'
import { getLangPair, setLangPair } from '../shared/languagePreference'
import { notify } from '../shared/notifications'

// "origin-target" pair strings, straight from the backend's own whitelist —
// every pair the catalog supports at all, shown here even for combinations
// this particular user isn't enabled for (see enabledPairs below).
const whitelist = ref([])
// The subset of `whitelist` this signed-in user actually has a "users"
// sheet row for (GET /user) — the only pairs selectable/savable. Everything
// else in `whitelist` still renders (all flags stay visible), just disabled.
const enabledPairs = ref(new Set())
const selectedOrigin = ref('')
const selectedTarget = ref('')
const isLoading = ref(true)

const originOptions = computed(() => [...new Set(whitelist.value.map((pair) => pair.split('-')[0]))])
const enabledOrigins = computed(() => new Set([...enabledPairs.value].map((pair) => pair.split('-')[0])))

// Only the targets actually paired with the selected origin in the
// whitelist — not every target overall, so an unavailable combination can
// never appear as an option for this origin in the first place. Whether
// each one is *enabled* for this user is a separate check (enabledPairs).
const targetOptions = computed(() =>
  whitelist.value.filter((pair) => pair.split('-')[0] === selectedOrigin.value).map((pair) => pair.split('-')[1])
)

const canSave = computed(() =>
  !!selectedOrigin.value && enabledPairs.value.has(`${selectedOrigin.value}-${selectedTarget.value}`)
)

function selectOrigin(code) {
  if (!enabledOrigins.value.has(code)) return
  selectedOrigin.value = code
  const stillValid = enabledPairs.value.has(`${code}-${selectedTarget.value}`)
  if (!stillValid) {
    const enabledTarget = whitelist.value
      .filter((pair) => pair.split('-')[0] === code)
      .map((pair) => pair.split('-')[1])
      .find((target) => enabledPairs.value.has(`${code}-${target}`))
    selectedTarget.value = enabledTarget || ''
  }
}

function selectTarget(code) {
  if (!enabledPairs.value.has(`${selectedOrigin.value}-${code}`)) return
  selectedTarget.value = code
}

function save() {
  if (!canSave.value) return
  setLangPair(`${selectedOrigin.value}-${selectedTarget.value}`)
  notify('success', 'Language pair saved.')
}

// Runs once up front (from cache or the first live fetch) to pick an
// initial selection, and is *not* re-run when a background refresh brings
// in fresher data — refreshed whitelist/enabledPairs still take effect
// immediately since the template reads them reactively (a flag that
// becomes newly enabled/disabled updates on screen either way), but forcing
// a fresh selection on top of one the user may already be interacting with
// would be more surprising than helpful.
function resolveInitialSelection() {
  const [storedOrigin, storedTarget] = getLangPair().split('-')
  if (enabledPairs.value.has(`${storedOrigin}-${storedTarget}`)) {
    selectedOrigin.value = storedOrigin
    selectedTarget.value = storedTarget
  } else {
    const [fallbackOrigin, fallbackTarget] = ([...enabledPairs.value][0] || '-').split('-')
    selectedOrigin.value = fallbackOrigin
    selectedTarget.value = fallbackTarget
  }
}

// Catalog-wide, not per-user — same cache entry regardless of who's signed in.
async function loadLanguages() {
  const key = cacheKey('languages')
  const cached = readStale(key)
  if (cached) {
    whitelist.value = cached.data.languages || []
    refreshInBackground({
      key,
      label: 'languages',
      fetchFn: () => getLanguages(),
      onFresh: (data) => { whitelist.value = data.languages || [] },
    })
    return
  }

  const data = await getLanguages()
  whitelist.value = data.languages || []
  writeCache(key, data)
}

// Same cache "kind" HomePage.vue's own resolveLang() writes to — both pages
// read this user's GET /user record, so whichever page fetches it first
// saves the other page a redundant round trip switching back and forth
// between them.
async function loadUserPairs(email) {
  const key = cacheKey('user', email)
  const cached = readStale(key)
  if (cached) {
    enabledPairs.value = new Set(cached.data.language_pairs || [])
    refreshInBackground({
      key,
      label: 'account data',
      fetchFn: () => getUser(email),
      onFresh: (data) => { enabledPairs.value = new Set(data.language_pairs || []) },
    })
    return
  }

  const data = await getUser(email)
  enabledPairs.value = new Set(data.language_pairs || [])
  writeCache(key, data)
}

onMounted(async () => {
  const email = ensureUserEmail()
  try {
    await Promise.all([loadLanguages(), loadUserPairs(email)])
    resolveInitialSelection()
  } finally {
    isLoading.value = false
  }
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

.settings-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 20px 0;
}

.settings-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: settings-spin 0.8s linear infinite;
}

@keyframes settings-spin {
  to { transform: rotate(360deg); }
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

.lang-option:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
