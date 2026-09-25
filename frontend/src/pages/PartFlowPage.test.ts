import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import PartFlowPage from './PartFlowPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getChapters: vi.fn(),
    getWords: vi.fn(),
  }
})

const CHAPTERS = [
  {
    chapter_id: 'c1', number: 1, title: 'Basics', description: '', status: 'active',
    topics: [
      {
        topic_id: 't1', number: 1, title: 'Greetings', description: '',
        word_ids: ['w1', 'w2', 'w3', 'w4', 'w5'],
        texts: [], sentences: [], phrases: [], status: 'active', exercises: [],
      },
    ],
  },
]

const WORDS = [
  { word_id: 'w1', original: 'oi', filename: 'w1.png', sentence: '', cue: 'hi (cue)', gender_id: '' },
  { word_id: 'w2', original: 'tchau', filename: '', sentence: '', cue: 'bye (cue)', gender_id: '' },
  { word_id: 'w3', original: 'obrigado', filename: '', sentence: '', cue: 'thanks (cue)', gender_id: '' },
  { word_id: 'w4', original: 'por favor', filename: '', sentence: '', cue: 'please (cue)', gender_id: '' },
  { word_id: 'w5', original: 'bom dia', filename: '', sentence: '', cue: 'good morning (cue)', gender_id: '' },
]

async function mountFlow({ settle = true } = {}) {
  vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: CHAPTERS })
  vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-en', words: WORDS })

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/part/:topicId/:partNumber', name: 'part-flow', component: PartFlowPage },
    ],
  })
  router.push({ name: 'part-flow', params: { topicId: 't1', partNumber: '1' } })
  await router.isReady()

  const wrapper = mount(PartFlowPage, { attachTo: document.body, global: { plugins: [router] } })
  if (settle) await flushPromises()
  return { wrapper, router }
}

describe('PartFlowPage', () => {
  // Math.random always 0 => buildPartFlowSequence always picks the first
  // remaining word at each step, i.e. no interleaving: w1 p1,p2,p3, w2
  // p1,p2,p3, ... — makes the sequence deterministic for these assertions
  // (interleaving correctness itself is covered by shared/partFlow.test.ts).
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows a loading spinner until the topic/words fetch resolves, then the page', async () => {
    const { wrapper } = await mountFlow({ settle: false })
    try {
      expect(wrapper.find('.flow-spinner').exists()).toBe(true)
      expect(wrapper.find('.word-page-1').exists()).toBe(false)

      await flushPromises()

      expect(wrapper.find('.flow-spinner').exists()).toBe(false)
      expect(wrapper.find('.word-page-1').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('shows word 1 Page 1 first: image, cue, word, and an audio button', async () => {
    const { wrapper } = await mountFlow()
    try {
      const img = wrapper.get('.word-page-1-image-wrap img')
      // Absolute, not relative — this page is mounted at "/part/:topicId/
      // :partNumber" (deeper than "/"), so a relative "images/..." would
      // resolve against the wrong base and always 404.
      expect(img.attributes('src')).toBe('/images/w1.png')
      expect(wrapper.get('.word-page-1-cue').text()).toBe('hi (cue)')
      expect(wrapper.get('.word-page-1-word').text()).toBe('oi')
      expect(wrapper.find('.word-page-1-audio-btn').exists()).toBe(true)
      expect(wrapper.find('.word-page-1-cue-big').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('falls back to a big cue, no image, once every image extension errors', async () => {
    const { wrapper } = await mountFlow()
    try {
      // png, jpg, jpeg, webp, gif, jfif — the fallback chain in the component.
      for (let i = 0; i < 6; i++) {
        await wrapper.get('img').trigger('error')
      }
      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.get('.word-page-1-cue-big').text()).toBe('hi (cue)')
      // Only shown once (big), not duplicated at normal size too.
      expect(wrapper.find('.word-page-1-cue').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('shows the big cue immediately for a word with no filename at all', async () => {
    const { wrapper } = await mountFlow()
    try {
      // Skip w1's Page 2 and Page 3 to reach w2 (no filename) Page 1.
      await wrapper.get('.flow-next-btn').trigger('click')
      await wrapper.get('.flow-next-btn').trigger('click')
      await wrapper.get('.flow-next-btn').trigger('click')

      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.get('.word-page-1-cue-big').text()).toBe('bye (cue)')
      expect(wrapper.get('.word-page-1-word').text()).toBe('tchau')
    } finally {
      wrapper.unmount()
    }
  })

  it('advances through Page 2, Page 3, then Reading and Listen-and-write, via Next', async () => {
    const { wrapper } = await mountFlow()
    try {
      await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
      expect(wrapper.find('.word-page-2').exists()).toBe(true)

      await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 3
      expect(wrapper.find('.word-page-3').exists()).toBe(true)

      // 13 more clicks (2 already spent on w1's Page 2/3) reaches step index
      // 15 of 17 — every word's 3 pages done — which is Reading.
      for (let i = 0; i < 13; i++) {
        await wrapper.get('.flow-next-btn').trigger('click')
      }
      expect(wrapper.get('.placeholder-page').text()).toBe('Reading page — coming soon')

      await wrapper.get('.flow-next-btn').trigger('click')
      expect(wrapper.get('.placeholder-page').text()).toBe('Listen and write page — coming soon')

      // Next past the last page is a no-op, not a crash.
      await wrapper.get('.flow-next-btn').trigger('click')
      expect(wrapper.get('.placeholder-page').text()).toBe('Listen and write page — coming soon')
    } finally {
      wrapper.unmount()
    }
  })

  it('fills the progress bar as steps advance', async () => {
    const { wrapper } = await mountFlow()
    try {
      expect(wrapper.get('.flow-progress-fill').attributes('style')).toContain(`width: ${(1 / 17) * 100}%`)

      await wrapper.get('.flow-next-btn').trigger('click')
      expect(wrapper.get('.flow-progress-fill').attributes('style')).toContain(`width: ${(2 / 17) * 100}%`)
    } finally {
      wrapper.unmount()
    }
  })

  it('the Exit button navigates back to Home', async () => {
    const { wrapper, router } = await mountFlow()
    try {
      await wrapper.get('.flow-exit-btn').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/')
    } finally {
      wrapper.unmount()
    }
  })

  describe('word Page 2 (voice recognition)', () => {
    it('shows the word big, a mic button, and a "not supported" hint when the browser lacks SpeechRecognition', async () => {
      const { wrapper } = await mountFlow()
      try {
        await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
        expect(wrapper.get('.word-page-2-word').text()).toBe('oi')
        expect(wrapper.get('.word-page-2-mic-btn').attributes('disabled')).toBeDefined()
        expect(wrapper.get('.word-page-2-hint').text()).toBe("Voice recognition isn't supported in this browser.")
      } finally {
        wrapper.unmount()
      }
    })

    describe('when the browser supports SpeechRecognition', () => {
      class MockSpeechRecognition {
        start = vi.fn()
        abort = vi.fn()
        onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null = null
        onerror: (() => void) | null = null
        onend: (() => void) | null = null
        lang = ''
        interimResults = false
        maxAlternatives = 1

        constructor() {
          instances.push(this)
        }
      }

      let instances: MockSpeechRecognition[]

      beforeEach(() => {
        instances = []
        ;(window as any).SpeechRecognition = MockSpeechRecognition
      })

      afterEach(() => {
        delete (window as any).SpeechRecognition
      })

      it('tapping the mic starts listening: disables the mic and shows a wave', async () => {
        const { wrapper } = await mountFlow()
        try {
          await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
          await wrapper.get('.word-page-2-mic-btn').trigger('click')

          expect(wrapper.get('.word-page-2-mic-btn').attributes('disabled')).toBeDefined()
          expect(wrapper.find('.word-page-2-wave').exists()).toBe(true)
          expect(instances[0].start).toHaveBeenCalledOnce()
        } finally {
          wrapper.unmount()
        }
      })

      it('shows a success message when the recognized speech matches the word, then re-enables the mic', async () => {
        const { wrapper } = await mountFlow()
        try {
          await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
          await wrapper.get('.word-page-2-mic-btn').trigger('click')

          instances[0].onresult!({ results: [[{ transcript: 'Oi!' }]] })
          await flushPromises()

          expect(wrapper.get('.word-page-2-result').classes()).toContain('success')
          expect(wrapper.find('.word-page-2-wave').exists()).toBe(false)
          expect(wrapper.get('.word-page-2-mic-btn').attributes('disabled')).toBeUndefined()
        } finally {
          wrapper.unmount()
        }
      })

      it('auto-advances to the next page 1s after a correct spoken word', async () => {
        vi.useFakeTimers()
        const { wrapper } = await mountFlow()
        try {
          await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
          await wrapper.get('.word-page-2-mic-btn').trigger('click')

          instances[0].onresult!({ results: [[{ transcript: 'Oi!' }]] })
          await flushPromises()
          expect(wrapper.get('.word-page-2-result').classes()).toContain('success')

          await vi.advanceTimersByTimeAsync(999)
          expect(wrapper.find('.word-page-2').exists()).toBe(true)

          await vi.advanceTimersByTimeAsync(1)
          expect(wrapper.find('.word-page-3').exists()).toBe(true)
        } finally {
          wrapper.unmount()
        }
      })

      it('shows a failure message when the recognized speech does not match, and allows retrying', async () => {
        const { wrapper } = await mountFlow()
        try {
          await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
          await wrapper.get('.word-page-2-mic-btn').trigger('click')

          instances[0].onresult!({ results: [[{ transcript: 'tchau' }]] })
          await flushPromises()

          expect(wrapper.get('.word-page-2-result').classes()).toContain('failure')
          expect(wrapper.get('.word-page-2-mic-btn').attributes('disabled')).toBeUndefined()

          await wrapper.get('.word-page-2-mic-btn').trigger('click')
          expect(wrapper.find('.word-page-2-wave').exists()).toBe(true)
          expect(instances).toHaveLength(2)
        } finally {
          wrapper.unmount()
        }
      })

      it('treats a recognition error as a failure', async () => {
        const { wrapper } = await mountFlow()
        try {
          await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
          await wrapper.get('.word-page-2-mic-btn').trigger('click')

          instances[0].onerror!()
          await flushPromises()

          expect(wrapper.get('.word-page-2-result').classes()).toContain('failure')
        } finally {
          wrapper.unmount()
        }
      })
    })
  })

  describe('word Page 3 (type the word)', () => {
    async function goToPage3(wrapper: ReturnType<typeof mount>) {
      await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
      await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 3
    }

    it('shows the image/cue like Page 1, plus a text input, audio button, and Check button — no word shown', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToPage3(wrapper)

        const page = wrapper.get('.word-page-3')
        expect(page.get('.word-page-1-image-wrap img').attributes('src')).toBe('/images/w1.png')
        expect(page.get('.word-page-1-cue').text()).toBe('hi (cue)')
        expect(page.find('.word-page-1-word').exists()).toBe(false)
        expect(page.get('.word-page-3-input').element.tagName).toBe('INPUT')
        expect(page.find('.word-page-1-audio-btn').exists()).toBe(true)
        expect(page.get('.word-page-3-check-btn').text()).toBe('✓')
      } finally {
        wrapper.unmount()
      }
    })

    it('typing the wrong word and checking shows a per-letter diff, keeps the input editable, and does not advance', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToPage3(wrapper)

        await wrapper.get('.word-page-3-input').setValue('ai')
        await wrapper.get('.word-page-3-check-btn').trigger('click')

        const letters = wrapper.findAll('.word-page-3-result span').map((s) => s.classes()[0])
        expect(letters).toContain('word-page-3-letter-wrong')
        expect(wrapper.get<HTMLInputElement>('.word-page-3-input').element.disabled).toBe(false)
        expect(wrapper.find('.word-page-3').exists()).toBe(true)
      } finally {
        wrapper.unmount()
      }
    })

    it('typing the correct word and checking applies a success style, then auto-advances 1s later', async () => {
      vi.useFakeTimers()
      const { wrapper } = await mountFlow()
      try {
        await goToPage3(wrapper)

        await wrapper.get('.word-page-3-input').setValue('oi')
        await wrapper.get('.word-page-3-check-btn').trigger('click')

        expect(wrapper.get('.word-page-3-input').classes()).toContain('success')
        expect(wrapper.get<HTMLInputElement>('.word-page-3-input').element.disabled).toBe(true)

        await vi.advanceTimersByTimeAsync(999)
        expect(wrapper.find('.word-page-3').exists()).toBe(true)

        await vi.advanceTimersByTimeAsync(1)
        expect(wrapper.find('.word-page-3').exists()).toBe(false)
        expect(wrapper.get('.word-page-1 .word-page-1-cue-big').text()).toBe('bye (cue)')
      } finally {
        wrapper.unmount()
      }
    })

    it('pressing Enter in the input checks the answer, same as clicking Check', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToPage3(wrapper)

        await wrapper.get('.word-page-3-input').setValue('oi')
        await wrapper.get('.word-page-3-input').trigger('keydown', { key: 'Enter' })

        expect(wrapper.get('.word-page-3-input').classes()).toContain('success')
      } finally {
        wrapper.unmount()
      }
    })
  })
})
