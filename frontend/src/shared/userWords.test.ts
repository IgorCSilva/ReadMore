import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { cacheKey, readCache, writeCache } from './cache'
import { getNotifications } from './notifications'
import {
  applyPendingUpdate,
  hasPendingUpdate,
  loadUserWords,
  patchUserWord,
  resetUserWordsStoreForTests,
} from './userWords'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    getUserWords: vi.fn(),
  }
})

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

const WORD_A = {
  word_id: 'wd-0001',
  original: 'hola',
  filename: 'hello.webp',
  sentence: '',
  cue: '',
  gender_id: 'not_apply',
  confident: false,
  shown_count: 0,
  show: true,
}
const WORD_B = { ...WORD_A, word_id: 'wd-0002', original: 'chao' }

const USER = 'test@example.com'
const LANG = 'pt-es'
const SENTENCE_LANG = 'target'
const CUE_LANG = 'origin'

function key() {
  return cacheKey('user-words', USER, LANG, SENTENCE_LANG, CUE_LANG)
}

describe('userWords', () => {
  beforeEach(() => {
    localStorage.clear()
    clearNotifications()
    resetUserWordsStoreForTests()
    vi.mocked(api.getUserWords).mockReset()
  })

  it('fetches over the network on the first call when nothing is cached', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_A] })

    const result = await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)

    expect(result).toEqual([WORD_A])
    expect(api.getUserWords).toHaveBeenCalledTimes(1)
    expect(readCache(key())?.data).toEqual([WORD_A])
  })

  it('does not fetch again on a later call for the same key', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_A] })
    await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)

    vi.mocked(api.getUserWords).mockClear()
    const second = await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)

    expect(second).toEqual([WORD_A])
    expect(api.getUserWords).not.toHaveBeenCalled()
  })

  it('dedupes concurrent first-time calls for the same key into one fetch', async () => {
    let resolveFetch: (v: { lang: string; words: typeof WORD_A[] }) => void
    vi.mocked(api.getUserWords).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const p1 = loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)
    const p2 = loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)
    resolveFetch!({ lang: LANG, words: [WORD_A] })

    expect(await p1).toEqual([WORD_A])
    expect(await p2).toEqual([WORD_A])
    expect(api.getUserWords).toHaveBeenCalledTimes(1)
  })

  it('serves a cache hit instantly and kicks exactly one background check', async () => {
    writeCache(key(), [WORD_A])
    vi.mocked(api.getUserWords).mockReturnValue(new Promise(() => {})) // never resolves

    const result = await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)

    expect(result).toEqual([WORD_A])
    expect(api.getUserWords).toHaveBeenCalledTimes(1)

    // A second call while the background check is still in flight must not
    // fire a second one.
    await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)
    expect(api.getUserWords).toHaveBeenCalledTimes(1)
  })

  it('a background check finding identical data is a silent no-op, never parked as pending', async () => {
    writeCache(key(), [WORD_A])
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_A] })

    await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)
    await vi.waitFor(() => expect(api.getUserWords).toHaveBeenCalledTimes(1))

    expect(hasPendingUpdate(USER, LANG, SENTENCE_LANG, CUE_LANG)).toBe(false)
    expect(getNotifications()).toHaveLength(0)
  })

  it('a background check finding different data parks it as pending instead of applying it', async () => {
    writeCache(key(), [WORD_A])
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_A, WORD_B] })

    const result = await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)
    expect(result).toEqual([WORD_A]) // not applied yet

    await vi.waitFor(() => {
      expect(hasPendingUpdate(USER, LANG, SENTENCE_LANG, CUE_LANG)).toBe(true)
    })
    expect(getNotifications()[0]).toMatchObject({ type: 'info' })
    // still not applied automatically
    expect(await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)).toEqual([WORD_A])
  })

  it('applyPendingUpdate swaps in the parked data and clears pending', async () => {
    writeCache(key(), [WORD_A])
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_A, WORD_B] })
    await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)
    await vi.waitFor(() => expect(hasPendingUpdate(USER, LANG, SENTENCE_LANG, CUE_LANG)).toBe(true))

    const applied = applyPendingUpdate(USER, LANG, SENTENCE_LANG, CUE_LANG)

    expect(applied).toEqual([WORD_A, WORD_B])
    expect(hasPendingUpdate(USER, LANG, SENTENCE_LANG, CUE_LANG)).toBe(false)
    expect(await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)).toEqual([WORD_A, WORD_B])
    expect(readCache(key())?.data).toEqual([WORD_A, WORD_B])
  })

  it('applyPendingUpdate returns null when nothing is pending', () => {
    expect(applyPendingUpdate(USER, LANG, SENTENCE_LANG, CUE_LANG)).toBeNull()
  })

  it('patchUserWord mutates only the matching word in place', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_A, WORD_B] })
    await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)

    patchUserWord(USER, LANG, SENTENCE_LANG, CUE_LANG, WORD_A.word_id, { show: false })

    const result = await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)
    expect(result.find((w) => w.word_id === WORD_A.word_id)?.show).toBe(false)
    expect(result.find((w) => w.word_id === WORD_B.word_id)?.show).toBe(true)
  })

  it('patchUserWord is a no-op when nothing has been loaded for that key yet', () => {
    expect(() => patchUserWord(USER, LANG, SENTENCE_LANG, CUE_LANG, WORD_A.word_id, { show: false })).not.toThrow()
  })

  it('a different key (e.g. a different sentenceLang) fetches independently, not affected by another key being loaded', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_A] })
    await loadUserWords(USER, LANG, SENTENCE_LANG, CUE_LANG)

    vi.mocked(api.getUserWords).mockClear()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_B] })
    const result = await loadUserWords(USER, LANG, 'origin', CUE_LANG)

    expect(result).toEqual([WORD_B])
    expect(api.getUserWords).toHaveBeenCalledTimes(1)
  })
})
