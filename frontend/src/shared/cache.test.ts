import { beforeEach, describe, expect, it } from 'vitest'
import { cacheKey, readCache, writeCache } from './cache'

describe('cache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips data through writeCache/readCache with a timestamp', () => {
    const key = cacheKey('test', 'a', 'b')
    const before = Date.now()

    writeCache(key, { hello: 'world' })
    const entry = readCache<{ hello: string }>(key)

    expect(entry).not.toBeNull()
    expect(entry?.data).toEqual({ hello: 'world' })
    expect(entry?.savedAt).toBeGreaterThanOrEqual(before)
  })

  it('returns null for a missing key', () => {
    expect(readCache(cacheKey('nope'))).toBeNull()
  })

  it('returns null instead of throwing for corrupt JSON', () => {
    const key = cacheKey('corrupt')
    localStorage.setItem(key, '{not valid json')

    expect(readCache(key)).toBeNull()
  })

  it('returns null for a stored value that is not a cache-entry shape', () => {
    const key = cacheKey('wrong-shape')
    localStorage.setItem(key, JSON.stringify({ foo: 'bar' }))

    expect(readCache(key)).toBeNull()
  })

  it('builds distinct keys per part so different users/langs never collide', () => {
    expect(cacheKey('data', 'a@example.com', 'pt-en')).not.toBe(cacheKey('data', 'b@example.com', 'pt-en'))
    expect(cacheKey('data', 'a@example.com', 'pt-en')).not.toBe(cacheKey('data', 'a@example.com', 'pt-es'))
  })
})
