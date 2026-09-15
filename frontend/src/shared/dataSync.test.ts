import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cacheKey, readCache } from './cache'
import { readStale, refreshInBackground } from './dataSync'
import { getNotifications } from './notifications'

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

describe('dataSync', () => {
  beforeEach(() => {
    localStorage.clear()
    clearNotifications()
  })

  it('readStale returns null when nothing is cached', () => {
    expect(readStale(cacheKey('thing', 'missing'))).toBeNull()
  })

  it('refreshInBackground notifies info immediately, then success + onFresh + cache write on success', async () => {
    const key = cacheKey('thing', 'a')
    const onFresh = vi.fn()

    refreshInBackground({
      key,
      label: 'thing',
      fetchFn: () => Promise.resolve({ value: 42 }),
      onFresh,
    })

    expect(getNotifications()[0]).toMatchObject({ type: 'info' })

    await vi.waitFor(() => {
      expect(onFresh).toHaveBeenCalledWith({ value: 42 })
    })

    expect(readCache(key)?.data).toEqual({ value: 42 })
    expect(getNotifications().some((n) => n.type === 'success')).toBe(true)
  })

  it('refreshInBackground notifies an error and never calls onFresh on failure', async () => {
    const onFresh = vi.fn()

    refreshInBackground({
      key: cacheKey('thing', 'b'),
      label: 'thing',
      fetchFn: () => Promise.reject(new Error('boom')),
      onFresh,
    })

    await vi.waitFor(() => {
      expect(getNotifications().some((n) => n.type === 'error')).toBe(true)
    })
    expect(onFresh).not.toHaveBeenCalled()
  })
})
