import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { cacheKey, writeCache } from './cache'
import UpdateAvailableBanner from './UpdateAvailableBanner.vue'
import { loadUserWords, resetUserWordsStoreForTests } from './userWords'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    getUserWords: vi.fn(),
  }
})

const WORD_A = {
  word_id: 'wd-0001',
  original: 'hola',
  filename: 'hello.webp',
  sentence: '',
  cue: '',
  gender_id: 'not_apply',
  particle_type: 'not_apply',
  confident: false,
  shown_count: 0,
  show: true,
}
const WORD_B = { ...WORD_A, word_id: 'wd-0002', original: 'chao' }

const USER = 'test@example.com'
const LANG = 'pt-es'

describe('UpdateAvailableBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    resetUserWordsStoreForTests()
    vi.mocked(api.getUserWords).mockReset()
  })

  it('stays hidden when nothing is being watched, or nothing is pending', async () => {
    const wrapper = mount(UpdateAvailableBanner)
    expect(wrapper.find('.update-banner').exists()).toBe(false)

    wrapper.vm.watch(USER, LANG, 'target', 'origin', vi.fn())
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.update-banner').exists()).toBe(false)
  })

  it('appears once a background check parks a different update, and applying it calls onApplied', async () => {
    writeCache(cacheKey('user-words', USER, LANG, 'target', 'origin'), [WORD_A])
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: LANG, words: [WORD_A, WORD_B] })

    const wrapper = mount(UpdateAvailableBanner)
    const onApplied = vi.fn()
    wrapper.vm.watch(USER, LANG, 'target', 'origin', onApplied)
    await loadUserWords(USER, LANG, 'target', 'origin')

    await vi.waitFor(async () => {
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.update-banner').exists()).toBe(true)
    })

    await wrapper.find('.update-banner-btn').trigger('click')

    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.update-banner').exists()).toBe(false)
    expect(await loadUserWords(USER, LANG, 'target', 'origin')).toEqual([WORD_A, WORD_B])
  })
})
