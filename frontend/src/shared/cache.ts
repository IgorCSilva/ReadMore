// localStorage-backed cache for GET responses, so pages can render instantly
// from the last-known data instead of blocking on a Sheets-backed round
// trip every time — see shared/dataSync.ts for the stale-while-revalidate
// flow built on top of this.

// Bumping this prefix invalidates every existing entry at once (old entries
// are simply never read again) — the escape hatch for a future response
// shape change, without needing per-entry migration logic.
const CACHE_PREFIX = 'readmore:cache:v1:'

export interface CacheEntry<T> {
  data: T
  savedAt: number
}

export function cacheKey(kind: string, ...parts: string[]): string {
  return CACHE_PREFIX + [kind, ...parts].map(encodeURIComponent).join(':')
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return null // private browsing / storage disabled — treat as a cache miss
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('data' in parsed) ||
      !('savedAt' in parsed)
    ) {
      return null
    }
    return parsed as CacheEntry<T>
  } catch {
    return null // corrupt or pre-existing-format entry — treat as a cache miss, not a crash
  }
}

export function writeCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, savedAt: Date.now() }
  try {
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Quota exceeded or storage disabled — caching is a nice-to-have; the
    // app still works correctly without it, just without the speedup.
  }
}
