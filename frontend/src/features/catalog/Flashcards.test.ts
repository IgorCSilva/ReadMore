import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import Flashcards from './Flashcards.vue'

vi.mock('../../shared/api', () => ({
  getUserWords: vi.fn(),
  incrementShownCount: vi.fn(() => Promise.resolve(new Response())),
  markWordKnown: vi.fn(() => Promise.resolve(new Response())),
  showWordAgain: vi.fn(() => Promise.resolve(new Response())),
  ttsUrl: (text: string) => `/tts?text=${encodeURIComponent(text)}`,
}))

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

describe('Flashcards', () => {
  beforeEach(() => {
    vi.mocked(api.getUserWords).mockReset()
    vi.mocked(api.markWordKnown).mockClear()
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
})
