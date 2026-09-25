const LANG_STORAGE_KEY = 'readmore_lang_pair'
const DEFAULT_PAIR = 'pt-en'

// Cached on first read, same "resolve once, reuse for the session" idiom as
// currentUser.ts's ensureUserEmail — every redesigned page (Home,
// PartFlowPage, ReadUnderstandPage, ListenIdentifyPage) reads this once at
// its own mount instead of hardcoding 'pt-en', so a language pair saved on
// SettingsPage takes effect the next time any of those pages loads.
let cached: string | null = null

// Drives which of the CSS accent trios (--accent/-soft/-strong, defined in
// App.vue's :root[data-lang=...] rules) is active — mirrors LibraryPage.vue's
// own setDataLang() for the legacy page. Falls back to "en" for a target
// this app doesn't have its own accent for yet, rather than leaving
// data-lang unset.
function applyAccent(pair: string): void {
  const [, target] = pair.split('-')
  const knownAccent = target === 'es' || target === 'ko' ? target : 'en'
  document.documentElement.setAttribute('data-lang', knownAccent)
}

export function getLangPair(): string {
  if (cached === null) {
    cached = localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_PAIR
  }
  return cached
}

export function setLangPair(pair: string): void {
  cached = pair
  localStorage.setItem(LANG_STORAGE_KEY, pair)
  applyAccent(pair)
}

// Applies the stored (or default) pair's accent immediately on app startup,
// so a full page load/refresh reflects a previously saved preference right
// away instead of only after a live in-session change via SettingsPage.
export function applyStoredAccent(): void {
  applyAccent(getLangPair())
}

// Test-only: `cached` is a module-level singleton, so without this, a test
// that saves a preference would leak it into every later test in the same
// file — same reasoning as userWords.ts's resetUserWordsStoreForTests.
export function resetLangPreferenceForTests(): void {
  cached = null
}
