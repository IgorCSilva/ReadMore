// Shared, deduplicated loader for the "user-words" resource that
// Flashcards/Typing/Reading/Quiz/Dictation/Phrases all read — one fetch per
// (user, lang, sentenceLang, cueLang) key per session, not one per tab
// switch, and a background-refreshed update is never applied silently
// mid-session: it's parked as "pending" until the user opts in (see
// UpdateAvailableBanner.vue). A module-level `reactive()` singleton, same
// idiom as shared/notifications.ts — this app has no store (Pinia/Vuex) and
// a keyed word-list cache doesn't need one either, every caller imports the
// same module instance.
import { reactive } from 'vue'
import { getUserWords } from './api'
import { cacheKey, readCache, writeCache } from './cache'
import { notify } from './notifications'
import type { UserWord } from './types'

interface UserWordsEntry {
  data: UserWord[] | null
  pendingData: UserWord[] | null
  hasFetchedOnce: boolean
  loadingPromise: Promise<UserWord[]> | null
}

const store = reactive<Record<string, UserWordsEntry>>({})

function keyFor(user: string, lang: string, sentenceLang: string, cueLang: string): string {
  return cacheKey('user-words', user, lang, sentenceLang, cueLang)
}

function getEntry(key: string): UserWordsEntry {
  let entry = store[key]
  if (!entry) {
    entry = { data: null, pendingData: null, hasFetchedOnce: false, loadingPromise: null }
    store[key] = entry
  }
  return entry
}

function sameData(a: UserWord[], b: UserWord[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// Runs once, right after the very first cache-hit load for a key — checks
// whether the server has something different than what's on screen. Never
// applies it: a match is a silent no-op (just refreshes the cache
// timestamp), a difference is parked in pendingData for the user to opt
// into via applyPendingUpdate().
function checkForUpdate(
  key: string,
  user: string,
  lang: string,
  sentenceLang: string,
  cueLang: string,
): void {
  const entry = getEntry(key)
  getUserWords(user, lang, sentenceLang, cueLang)
    .then((res) => {
      if (entry.data && sameData(entry.data, res.words)) {
        writeCache(key, res.words)
        return
      }
      entry.pendingData = res.words
      notify('info', 'New word data is available.')
    })
    .catch((err) => {
      notify('error', `Couldn't check for word list updates (${err.message}).`)
    })
}

// The only thing components call now. First call for a key: serve the
// cached copy instantly if present (kicking one background freshness
// check), else await the real fetch. Every later call for the *same* key —
// i.e. every subsequent tab switch — reuses the already-resolved data, no
// network call at all.
export async function loadUserWords(
  user: string,
  lang: string,
  sentenceLang: string,
  cueLang: string,
): Promise<UserWord[]> {
  const key = keyFor(user, lang, sentenceLang, cueLang)
  const entry = getEntry(key)

  if (entry.hasFetchedOnce) return entry.data ?? []
  if (entry.loadingPromise) return entry.loadingPromise

  const cached = readCache<UserWord[]>(key)
  if (cached) {
    entry.data = cached.data
    entry.hasFetchedOnce = true
    checkForUpdate(key, user, lang, sentenceLang, cueLang)
    return entry.data
  }

  entry.loadingPromise = getUserWords(user, lang, sentenceLang, cueLang)
    .then((res) => {
      writeCache(key, res.words)
      entry.data = res.words
      entry.hasFetchedOnce = true
      return res.words
    })
    .finally(() => {
      entry.loadingPromise = null
    })

  return entry.loadingPromise
}

export function hasPendingUpdate(
  user: string,
  lang: string,
  sentenceLang: string,
  cueLang: string,
): boolean {
  return getEntry(keyFor(user, lang, sentenceLang, cueLang)).pendingData !== null
}

// Applies a parked update: it becomes the new current data, cached to
// localStorage, pending cleared. Returns the applied data (or null if there
// was nothing pending) so the caller can immediately re-drive whatever it
// renders from it.
export function applyPendingUpdate(
  user: string,
  lang: string,
  sentenceLang: string,
  cueLang: string,
): UserWord[] | null {
  const key = keyFor(user, lang, sentenceLang, cueLang)
  const entry = getEntry(key)
  if (!entry.pendingData) return null
  entry.data = entry.pendingData
  entry.pendingData = null
  writeCache(key, entry.data)
  return entry.data
}

// Lets a write action (Flashcards' mark-known/show-word/increment) patch
// the shared word list in place, so switching to another tab reflects the
// change immediately instead of waiting for the next full reload or an
// applied background update — Flashcards' own optimistic in-memory update
// (see Flashcards.vue) never wrote back to this shared cache before, and
// other tabs used to pick the change up only by accident, whenever their
// own independent background refresh happened to land afterward. Now that
// fetching is once-per-key, that accidental propagation goes away, so this
// makes it deliberate instead.
export function patchUserWord(
  user: string,
  lang: string,
  sentenceLang: string,
  cueLang: string,
  wordId: string,
  patch: Partial<UserWord>,
): void {
  const entry = getEntry(keyFor(user, lang, sentenceLang, cueLang))
  if (!entry.data) return
  entry.data = entry.data.map((w) => (w.word_id === wordId ? { ...w, ...patch } : w))
}

// Test-only: the store is a module-level singleton, so without this, the
// second test in any file that reuses the same key (most do —
// test@example.com/pt-es/target/origin) would silently see the previous
// test's cached entry and skip fetching. Call from beforeEach.
export function resetUserWordsStoreForTests(): void {
  for (const key of Object.keys(store)) {
    delete store[key]
  }
}
