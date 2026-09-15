import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { getNotifications } from '../../shared/notifications'
import { getQueuedWrites } from '../../shared/writeQueue'
import Flashcards from './Flashcards.vue'

// importOriginal keeps the real NetworkError/HttpError classes (writeQueue.ts
// uses `instanceof` checks against them) while still mocking the network
// calls themselves.
vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return {
    ...actual,
    getUserWords: vi.fn(),
    incrementShownCount: vi.fn(() => Promise.resolve(new Response())),
    markWordKnown: vi.fn(() => Promise.resolve(new Response())),
    showWordAgain: vi.fn(() => Promise.resolve(new Response())),
    ttsUrl: (text: string) => `/tts?text=${encodeURIComponent(text)}`,
  }
})

const WORD = {
  word_id: 'en-0001',
  original: 'hello',
  filename: 'hello.webp',
  sentence: 'Hi, ___!',
  cue: 'a greeting',
  confident: false,
  shown_count: 0,
  show: true,
}

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

describe('Flashcards', () => {
  beforeEach(() => {
    localStorage.clear()
    clearNotifications()
    vi.mocked(api.getUserWords).mockReset()
    vi.mocked(api.markWordKnown).mockReset()
    vi.mocked(api.markWordKnown).mockResolvedValue(new Response())
    vi.mocked(api.incrementShownCount).mockReset()
    vi.mocked(api.incrementShownCount).mockResolvedValue(new Response())
  })

  it('flips to reveal the word on click, and mark-known removes it from the deck', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'english', words: [WORD] })

    const wrapper = mount(Flashcards, { attachTo: document.body })
    await wrapper.vm.load('test@example.com', 'english', null)

    const wordEl = wrapper.find('#word')
    expect(wordEl.text()).toBe('hello')
    expect(wordEl.classes()).toContain('hidden-word')

    await wordEl.trigger('click')
    expect(wordEl.classes()).not.toContain('hidden-word')

    await wrapper.find('#know-btn').trigger('click')

    expect(api.markWordKnown).toHaveBeenCalledWith('test@example.com', 'english', 'en-0001')
    expect(wrapper.find('#empty-state').isVisible()).toBe(true)
    expect(wrapper.find('#counter').text()).toBe('0 / 0')

    wrapper.unmount()
  })

  it('renders instantly from a cached word list and refreshes in the background', async () => {
    writeCache(cacheKey('user-words', 'test@example.com', 'english'), [WORD])
    // The background refresh call — never resolved in this test, so we can
    // assert on the immediate cache-backed render without racing it.
    vi.mocked(api.getUserWords).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(Flashcards, { attachTo: document.body })
    await wrapper.vm.load('test@example.com', 'english', null)

    expect(wrapper.find('#word').text()).toBe('hello')
    expect(api.getUserWords).toHaveBeenCalledWith('test@example.com', 'english')
    expect(getNotifications()[0]).toMatchObject({ type: 'info' })

    wrapper.unmount()
  })

  it('queues a mark-known write and notifies when the network is unavailable', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'english', words: [WORD] })
    vi.mocked(api.markWordKnown).mockRejectedValue(new api.NetworkError(new Error('offline')))

    const wrapper = mount(Flashcards, { attachTo: document.body })
    await wrapper.vm.load('test@example.com', 'english', null)

    await wrapper.find('#know-btn').trigger('click')

    await vi.waitFor(() => {
      expect(getQueuedWrites()).toHaveLength(1)
    })
    expect(getQueuedWrites()[0]).toMatchObject({
      type: 'mark-known',
      user: 'test@example.com',
      lang: 'english',
      wordId: 'en-0001',
    })
    expect(getNotifications().some((n) => n.type === 'warning')).toBe(true)

    wrapper.unmount()
  })
})
