// Stale-while-revalidate for GET data: callers check readStale() first and
// render immediately if there's a cache hit, then call refreshInBackground()
// to fetch the real thing behind the scenes, notifying the user along the
// way. Only used for reads — write retries live in shared/writeQueue.ts,
// which is a different problem (queueing, not caching).
import { readCache, writeCache, type CacheEntry } from './cache'
import { notify } from './notifications'

export function readStale<T>(key: string): CacheEntry<T> | null {
  return readCache<T>(key)
}

interface RefreshOptions<T> {
  key: string
  label: string
  fetchFn: () => Promise<T>
  onFresh: (data: T) => void
}

// Never throws — the caller already has data on screen from the cache, so a
// refresh failure is reported via toast, not a rejected promise the caller
// would need to handle too.
export function refreshInBackground<T>({ key, label, fetchFn, onFresh }: RefreshOptions<T>): void {
  notify('info', `Showing your saved ${label} — checking for updates…`)
  fetchFn()
    .then((data) => {
      writeCache(key, data)
      onFresh(data)
      notify('success', `Your ${label} is up to date.`)
    })
    .catch((err) => {
      notify('error', `Couldn't refresh your ${label} (${err.message}). Showing your last saved data.`)
    })
}
