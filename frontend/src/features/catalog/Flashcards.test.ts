import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    ttsUrl: (text: string, lang: string) =>
      `/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`,
  }
})

const WORD = {
  word_id: 'en-0001',
  original: 'hello',
  filename: 'hello.webp',
  sentence: 'Hi, ___!',
  cue: 'a greeting',
  gender_id: 'not_apply',
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
    // load() is called below with no sentence/cue-lang args, so Flashcards.vue
    // falls back to its own defaults ("target"/"origin") when building the
    // cache key — matched here.
    writeCache(cacheKey('user-words', 'test@example.com', 'english', 'target', 'origin'), [WORD])
    // The background refresh call — never resolved in this test, so we can
    // assert on the immediate cache-backed render without racing it.
    vi.mocked(api.getUserWords).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(Flashcards, { attachTo: document.body })
    await wrapper.vm.load('test@example.com', 'english', null)

    expect(wrapper.find('#word').text()).toBe('hello')
    expect(api.getUserWords).toHaveBeenCalledWith('test@example.com', 'english', 'target', 'origin')
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

  it('decorates the word and colors it according to its gender_id', async () => {
    const father = { ...WORD, word_id: 'en-0002', original: 'father', gender_id: 'masculine' }
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'english', words: [father] })

    const wrapper = mount(Flashcards, { attachTo: document.body })
    await wrapper.vm.load('test@example.com', 'english', null)

    const wordEl = wrapper.find('#word')
    expect(wordEl.text()).toBe('|father')
    expect((wordEl.element as HTMLElement).style.color).toBe('rgb(79, 140, 255)')

    wrapper.unmount()
  })

  describe('swipe/drag navigation', () => {
    const FATHER = { ...WORD, word_id: 'en-0002', original: 'father' }

    beforeEach(() => {
      // getBoundingClientRect is always zero-size in jsdom, which would make
      // the swipe-commit threshold (a fraction of card width) meaningless —
      // pin a realistic width so "past threshold" vs "not" is actually
      // distinguishable in these tests.
      vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 640,
      } as DOMRect)
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    // wrapper.trigger() builds a plain MouseEvent for unrecognized event
    // names, whose clientX is a read-only getter — it can't be overridden by
    // merging extra properties the way trigger() does for other fields. The
    // component only reads clientX/pointerId/pointerType/button, so a real
    // PointerEvent constructed with an init dict (and dispatched directly)
    // is what's needed here instead.
    function pointerEvent(type: string, init: PointerEventInit) {
      return new PointerEvent(type, { bubbles: true, cancelable: true, ...init })
    }

    async function drag(wrapper: ReturnType<typeof mount>, from: number, to: number) {
      const card = wrapper.find('#card').element
      card.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: from, pointerType: 'mouse', button: 0 }))
      card.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: to }))
      card.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: to }))
      await vi.advanceTimersByTimeAsync(0)
    }

    it('advances to the next card on a leftward drag past the threshold', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'english', words: [WORD, FATHER] })
      const wrapper = mount(Flashcards, { attachTo: document.body })
      await wrapper.vm.load('test@example.com', 'english', null)

      await drag(wrapper, 300, 100) // -200px, past 25% of 640px

      await vi.advanceTimersByTimeAsync(300)
      expect(wrapper.find('#word').text()).toBe('father')

      wrapper.unmount()
    })

    it('goes to the previous card on a rightward drag past the threshold', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'english', words: [WORD, FATHER] })
      const wrapper = mount(Flashcards, { attachTo: document.body })
      await wrapper.vm.load('test@example.com', 'english', null)

      await drag(wrapper, 100, 300) // +200px

      await vi.advanceTimersByTimeAsync(300)
      expect(wrapper.find('#word').text()).toBe('father') // wraps to the last card

      wrapper.unmount()
    })

    it('snaps back without advancing when the drag stays under the threshold', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'english', words: [WORD, FATHER] })
      const wrapper = mount(Flashcards, { attachTo: document.body })
      await wrapper.vm.load('test@example.com', 'english', null)

      await drag(wrapper, 300, 260) // -40px, under 25% of 640px

      await vi.advanceTimersByTimeAsync(300)
      expect(wrapper.find('#word').text()).toBe('hello')
      expect((wrapper.find('#card').element as HTMLElement).style.transform).toBe('')

      wrapper.unmount()
    })

    it('a plain click (no movement) still reveals the word, not a swipe', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'english', words: [WORD, FATHER] })
      const wrapper = mount(Flashcards, { attachTo: document.body })
      await wrapper.vm.load('test@example.com', 'english', null)

      const wordEl = wrapper.find('#word')
      await drag(wrapper, 300, 300) // no movement at all

      await vi.advanceTimersByTimeAsync(300)
      expect(wrapper.find('#word').text()).toBe('hello') // unchanged card

      await wordEl.trigger('click')
      expect(wordEl.classes()).not.toContain('hidden-word')

      wrapper.unmount()
    })
  })
})
