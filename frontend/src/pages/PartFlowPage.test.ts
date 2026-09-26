import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import { consumeHomeExpansion } from '../shared/homeExpansion'
import PartFlowPage from './PartFlowPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getChapters: vi.fn(),
    getWords: vi.fn(),
    getReinforcementWords: vi.fn(),
    // Stubbed (not just left real) so the Listen-and-write tests can assert
    // it's never called — proving Dictation's wordsOverride bypasses
    // loadUserWords entirely instead of silently falling through to it.
    getUserWords: vi.fn(),
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
  { word_id: 'w1', original: 'oi', filename: 'w1.png', sentence: '', cue: 'hi (cue)', gender_id: '', particle_type: '' },
  { word_id: 'w2', original: 'tchau', filename: '', sentence: '', cue: 'bye (cue)', gender_id: '', particle_type: '' },
  { word_id: 'w3', original: 'obrigado', filename: '', sentence: '', cue: 'thanks (cue)', gender_id: '', particle_type: '' },
  { word_id: 'w4', original: 'por favor', filename: '', sentence: '', cue: 'please (cue)', gender_id: '', particle_type: '' },
  { word_id: 'w5', original: 'bom dia', filename: '', sentence: '', cue: 'good morning (cue)', gender_id: '', particle_type: '' },
]

// A topic with two numbered parts (10 words, PART_SIZE 5) — only needed for
// the "finishing a part" tests below, which must exercise both "there's a
// next numbered Part" and "this was the last one" branches.
const WORDS_TWO_PARTS = Array.from({ length: 10 }, (_, i) => ({
  word_id: `tw${i + 1}`,
  original: `word${i + 1}`,
  filename: '',
  sentence: '',
  cue: `cue${i + 1}`,
  gender_id: '',
  particle_type: '',
}))
// Reinforcement word_ids come from earlier topics, not this one — these
// exist in the words catalog (so PartFlowPage's byId lookup resolves them)
// but are never part of any topic's own word_ids.
const REINFORCEMENT_WORDS = Array.from({ length: 7 }, (_, i) => ({
  word_id: `rw${i + 1}`,
  original: `reinforce${i + 1}`,
  filename: '',
  sentence: '',
  cue: `rcue${i + 1}`,
  gender_id: '',
  particle_type: '',
}))
const REINFORCEMENT_WORD_IDS = REINFORCEMENT_WORDS.map((w) => w.word_id)

const CHAPTERS_TWO_PARTS = [
  {
    chapter_id: 'c1', number: 1, title: 'Basics', description: '', status: 'active',
    topics: [
      {
        topic_id: 't1', number: 1, title: 'Greetings', description: '',
        word_ids: WORDS_TWO_PARTS.map((w) => w.word_id),
        texts: [], sentences: [], phrases: [], status: 'active', exercises: [],
      },
    ],
  },
]

// The bottom bar's Next is disabled on a word's Page 3 until it's typed
// correctly — every test that walks multiple steps forward now needs to
// solve whichever Page 3 it lands on along the way instead of blindly
// clicking. Looks up the right answer via the cue text (shown on both Page 1
// and Page 3), so it works for whichever word is currently active.
const WORD_BY_CUE = new Map(WORDS.map((w) => [w.cue, w.original]))
const WORD_BY_CUE_TWO_PARTS = new Map(WORDS_TWO_PARTS.map((w) => [w.cue, w.original]))

async function clickNext(wrapper: ReturnType<typeof mount>, wordByCue = WORD_BY_CUE) {
  const input = wrapper.find<HTMLInputElement>('.word-page-3-input')
  if (input.exists()) {
    const cueText = wrapper.get('.word-page-1-cue, .word-page-1-cue-big').text()
    await input.setValue(wordByCue.get(cueText))
    await wrapper.get('.word-page-3-check-btn').trigger('click')
  }
  await wrapper.get('.flow-next-btn').trigger('click')
}

// Sequence is words*3 (15) + reading + listen-write (17 total); listen-write
// is the last step, index 16 — 16 steps from start, passing through (and
// solving) every word's Page 3 along the way.
async function goToListenWrite(wrapper: ReturnType<typeof mount>, wordByCue = WORD_BY_CUE) {
  for (let i = 0; i < 16; i++) {
    await clickNext(wrapper, wordByCue)
  }
}

async function mountFlow({ settle = true } = {}) {
  vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: CHAPTERS })
  vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-en', words: WORDS })
  vi.mocked(api.getReinforcementWords).mockResolvedValue([])

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/home', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/part/:topicId/:partNumber', name: 'part-flow', component: PartFlowPage },
    ],
  })
  router.push({ name: 'part-flow', params: { topicId: 't1', partNumber: '1' } })
  await router.isReady()

  const wrapper = mount(PartFlowPage, { attachTo: document.body, global: { plugins: [router] } })
  if (settle) await flushPromises()
  return { wrapper, router }
}

async function mountFlowWithTwoParts(partNumber: string, reinforcementWordIds: string[] = []) {
  vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: CHAPTERS_TWO_PARTS })
  vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-en', words: [...WORDS_TWO_PARTS, ...REINFORCEMENT_WORDS] })
  vi.mocked(api.getReinforcementWords).mockResolvedValue(reinforcementWordIds)

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/home', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/part/:topicId/:partNumber', name: 'part-flow', component: PartFlowPage },
    ],
  })
  router.push({ name: 'part-flow', params: { topicId: 't1', partNumber } })
  await router.isReady()

  const wrapper = mount(PartFlowPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
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
      await clickNext(wrapper)
      await clickNext(wrapper)
      await clickNext(wrapper)

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

      // 13 more steps (2 already spent on w1's Page 2/3) reaches step index
      // 15 of 17 — every word's 3 pages done — which is Reading. Page 3 is
      // gated, so clickNext solves whichever word's Page 3 it lands on.
      for (let i = 0; i < 13; i++) {
        await clickNext(wrapper)
      }
      expect(wrapper.find('.reading-page').exists()).toBe(true)

      await clickNext(wrapper)
      expect(wrapper.find('#topic-dictation-panel').exists()).toBe(true)
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
      expect(router.currentRoute.value.path).toBe('/home')
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

    it('disables the bottom bar Next button until the correct word is typed and checked', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToPage3(wrapper)
        expect(wrapper.get<HTMLButtonElement>('.flow-next-btn').element.disabled).toBe(true)

        await wrapper.get('.word-page-3-input').setValue('ai')
        await wrapper.get('.word-page-3-check-btn').trigger('click')
        expect(wrapper.get<HTMLButtonElement>('.flow-next-btn').element.disabled).toBe(true)

        await wrapper.get('.word-page-3-input').setValue('oi')
        await wrapper.get('.word-page-3-check-btn').trigger('click')
        expect(wrapper.get<HTMLButtonElement>('.flow-next-btn').element.disabled).toBe(false)
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('Reading page', () => {
    async function goToReading(wrapper: ReturnType<typeof mount>) {
      // Sequence is words*3 (15) + reading + listen-write (17 total); Reading
      // is step index 15, i.e. 15 steps from the initial step 0 — passing
      // through (and solving) every word's Page 3 along the way.
      for (let i = 0; i < 15; i++) {
        await clickNext(wrapper)
      }
    }

    // Math.random always 0 (see the outer beforeEach) makes this file's own
    // Fisher-Yates shuffle deterministic too: starting from [w1..w5], it
    // always ends as [w2, w3, w4, w5, w1] — i.e. 'tchau', 'obrigado',
    // 'por favor', 'bom dia', 'oi'.

    it('shows only this part\'s words as tappable cards, one at a time, wrapping at the end', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToReading(wrapper)

        expect(wrapper.get('.reading-page-counter').text()).toBe('1 / 5')
        expect(wrapper.get('.reading-page-word').text()).toBe('tchau')

        await wrapper.get('.reading-page-card').trigger('click')
        expect(wrapper.get('.reading-page-counter').text()).toBe('2 / 5')
        expect(wrapper.get('.reading-page-word').text()).toBe('obrigado')

        for (let i = 0; i < 3; i++) {
          await wrapper.get('.reading-page-card').trigger('click')
        }
        expect(wrapper.get('.reading-page-word').text()).toBe('oi')

        await wrapper.get('.reading-page-card').trigger('click') // wraps
        expect(wrapper.get('.reading-page-counter').text()).toBe('1 / 5')
        expect(wrapper.get('.reading-page-word').text()).toBe('tchau')
      } finally {
        wrapper.unmount()
      }
    })

    it('picks a genuinely random next word among the others, not just the next one in sequence', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToReading(wrapper) // shuffled order still built under the always-0 mock: [w2,w3,w4,w5,w1]
        expect(wrapper.get('.reading-page-word').text()).toBe('tchau') // index 0

        // 5 words -> offset = 1 + floor(random * 4); random=0.9 -> offset=4,
        // landing on index (0 + 4) % 5 = 4 ('oi') — a jump a naive "+1" would
        // never produce (that would land on 'obrigado', index 1).
        vi.spyOn(Math, 'random').mockReturnValue(0.9)
        await wrapper.get('.reading-page-card').trigger('click')
        expect(wrapper.get('.reading-page-word').text()).toBe('oi')
      } finally {
        wrapper.unmount()
      }
    })

    it('the auto-pass button starts unpressed and toggles a pressed style on click', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToReading(wrapper)

        const btn = wrapper.get('.reading-page-autopass-btn')
        expect(btn.classes()).not.toContain('pressed')

        await btn.trigger('click')
        expect(wrapper.get('.reading-page-autopass-btn').classes()).toContain('pressed')

        await wrapper.get('.reading-page-autopass-btn').trigger('click')
        expect(wrapper.get('.reading-page-autopass-btn').classes()).not.toContain('pressed')
      } finally {
        wrapper.unmount()
      }
    })

    it('when auto-pass is on, advances by itself after (word length × ms-per-char), then reschedules for the next word', async () => {
      vi.useFakeTimers()
      const { wrapper } = await mountFlow()
      try {
        await goToReading(wrapper)
        await wrapper.get('.reading-page-autopass-btn').trigger('click')

        // 'tchau' (5 chars) at the default speed (3, i.e. (10+1-3)*100 = 800ms/char): 5 * 800 = 4000ms.
        await vi.advanceTimersByTimeAsync(3999)
        expect(wrapper.get('.reading-page-word').text()).toBe('tchau')

        await vi.advanceTimersByTimeAsync(1)
        expect(wrapper.get('.reading-page-word').text()).toBe('obrigado')

        // 'obrigado' (8 chars) at the same 800ms/char: 8 * 800 = 6400ms.
        await vi.advanceTimersByTimeAsync(6399)
        expect(wrapper.get('.reading-page-word').text()).toBe('obrigado')

        await vi.advanceTimersByTimeAsync(1)
        expect(wrapper.get('.reading-page-word').text()).toBe('por favor')
      } finally {
        wrapper.unmount()
      }
    })

    it('a higher speed value passes words faster (shorter on-screen time), not slower', async () => {
      vi.useFakeTimers()
      const { wrapper } = await mountFlow()
      try {
        await goToReading(wrapper)
        await wrapper.get('.reading-page-autopass-btn').trigger('click')

        // Raise from the default speed (3) to the max (10) before the first
        // advance fires: reschedules 'tchau' (5 chars) at the fastest
        // ms-per-char, (10+1-10)*100 = 100ms/char -> 5 * 100 = 500ms, much
        // shorter than the 4000ms the default speed would have taken.
        await wrapper.get('.reading-page-velocity input').setValue(10)

        await vi.advanceTimersByTimeAsync(499)
        expect(wrapper.get('.reading-page-word').text()).toBe('tchau')

        await vi.advanceTimersByTimeAsync(1)
        expect(wrapper.get('.reading-page-word').text()).toBe('obrigado')
      } finally {
        wrapper.unmount()
      }
    })

    it('clicking the card manually cancels the pending auto-pass timer for the word it left', async () => {
      vi.useFakeTimers()
      const { wrapper } = await mountFlow()
      try {
        await goToReading(wrapper)
        await wrapper.get('.reading-page-autopass-btn').trigger('click')

        await wrapper.get('.reading-page-card').trigger('click') // manual: tchau -> obrigado

        // If the 'tchau' timer (4000ms) had survived, it would have fired an
        // extra advance somewhere in here and skipped past 'obrigado' (whose
        // own timer needs 6400ms).
        await vi.advanceTimersByTimeAsync(4000)
        expect(wrapper.get('.reading-page-word').text()).toBe('obrigado')
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('Listen and write page (reuses the Dictation tab)', () => {
    it('shows the Dictation drill running (not loading/error/empty), restricted to this part\'s 5 words, without ever calling loadUserWords/getUserWords', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToListenWrite(wrapper)

        expect(wrapper.get<HTMLElement>('#topic-dictation-panel').element.style.display).toBe('flex')
        expect(wrapper.get<HTMLElement>('#dictation-stage').element.style.display).toBe('flex')
        expect(wrapper.get<HTMLElement>('#dictation-empty-state').element.style.display).toBe('none')
        expect(wrapper.get<HTMLElement>('#dictation-error-banner').element.style.display).toBe('none')
        expect(wrapper.get('#dictation-counter').text()).toBe('1 / 5')
        expect(api.getUserWords).not.toHaveBeenCalled()
      } finally {
        wrapper.unmount()
      }
    })

    it('typing the correct word and checking marks it right, then auto-advances to the next word 1s later', async () => {
      vi.useFakeTimers()
      const { wrapper } = await mountFlow()
      try {
        await goToListenWrite(wrapper)
        // Math.random pinned to 0 (outer beforeEach) shuffles this part's
        // words to ['tchau','obrigado','por favor','bom dia','oi'] — same
        // permutation already relied on by the Reading page tests above.
        expect(wrapper.get('#dictation-counter').text()).toBe('1 / 5')

        await wrapper.get<HTMLInputElement>('#dictation-input').setValue('tchau')
        await wrapper.get('#dictation-check-btn').trigger('click')

        const letterClasses = wrapper.findAll('#dictation-result-word span').map((s) => s.classes()[0])
        expect(letterClasses).toEqual(letterClasses.map(() => 'dictation-letter-correct'))
        expect(wrapper.get<HTMLButtonElement>('#dictation-check-btn').element.disabled).toBe(true)

        await vi.advanceTimersByTimeAsync(999)
        expect(wrapper.get('#dictation-counter').text()).toBe('1 / 5')

        await vi.advanceTimersByTimeAsync(1)
        expect(wrapper.get('#dictation-counter').text()).toBe('2 / 5')
        expect(wrapper.get<HTMLInputElement>('#dictation-input').element.value).toBe('')
      } finally {
        wrapper.unmount()
      }
    })

    it('typing the wrong word shows the per-letter diff and does not advance', async () => {
      const { wrapper } = await mountFlow()
      try {
        await goToListenWrite(wrapper)

        await wrapper.get<HTMLInputElement>('#dictation-input').setValue('xyz')
        await wrapper.get('#dictation-check-btn').trigger('click')

        const letterClasses = wrapper.findAll('#dictation-result-word span').map((s) => s.classes()[0])
        expect(letterClasses).toContain('dictation-letter-wrong')
        expect(wrapper.get<HTMLButtonElement>('#dictation-check-btn').element.disabled).toBe(false)
        expect(wrapper.get('#dictation-counter').text()).toBe('1 / 5')
      } finally {
        wrapper.unmount()
      }
    })

    it('pauses the Dictation round on unmount, canceling any pending auto-advance', async () => {
      vi.useFakeTimers()
      const { wrapper } = await mountFlow()
      try {
        await goToListenWrite(wrapper)
        await wrapper.get<HTMLInputElement>('#dictation-input').setValue('tchau')
        await wrapper.get('#dictation-check-btn').trigger('click')
        expect(wrapper.get<HTMLButtonElement>('#dictation-check-btn').element.disabled).toBe(true) // pending 1s auto-advance

        const counterEl = wrapper.get('#dictation-counter').element

        wrapper.unmount()
        await vi.advanceTimersByTimeAsync(5000)

        expect(counterEl.textContent).toBe('1 / 5') // never advanced to '2 / 5'
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('Finishing a part (bottom bar button on the last step)', () => {
    it('labels the button "Finish" only on the last step (Listen-and-write), "Next" everywhere else', async () => {
      const { wrapper } = await mountFlow()
      try {
        expect(wrapper.get('.flow-next-btn').text()).toBe('Next')

        await goToListenWrite(wrapper)
        expect(wrapper.get('.flow-next-btn').text()).toBe('Finish')
      } finally {
        wrapper.unmount()
      }
    })

    it('clicking Finish navigates home and requests the next numbered Part expanded, when one exists', async () => {
      const { wrapper, router } = await mountFlowWithTwoParts('1')
      try {
        await goToListenWrite(wrapper, WORD_BY_CUE_TWO_PARTS)
        await wrapper.get('.flow-next-btn').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/home')
        // 10 words = 2 numbered parts; finishing Part 1 (partIndex 0) should
        // request Part 2 (partIndex 1) expanded next.
        expect(consumeHomeExpansion()).toEqual({ topicId: 't1', partIndex: 1 })
      } finally {
        wrapper.unmount()
      }
    })

    it('clicking Finish requests "Read and Understand" expanded when this was the topic\'s last numbered Part', async () => {
      const { wrapper, router } = await mountFlowWithTwoParts('2')
      try {
        await goToListenWrite(wrapper, WORD_BY_CUE_TWO_PARTS)
        await wrapper.get('.flow-next-btn').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/home')
        // Part 2 is the last numbered part (indices 0-1); "Read and
        // Understand" is the next accordion entry, at index 2.
        expect(consumeHomeExpansion()).toEqual({ topicId: 't1', partIndex: 2 })
      } finally {
        wrapper.unmount()
      }
    })

    it('finishing the dedicated Review part requests "Read and Understand" expanded, one past the numbered parts', async () => {
      const { wrapper, router } = await mountFlowWithTwoParts('review', REINFORCEMENT_WORD_IDS)
      try {
        await wrapper.get('.flow-next-btn').trigger('click') // Reading -> Listen-and-write
        await wrapper.get('.flow-next-btn').trigger('click') // Finish
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/home')
        // Two numbered parts (indices 0-1); HomePage would only insert
        // Review at index 2 when leftover reinforcement words exist, so
        // "Read and Understand" sits one further, at index 3.
        expect(consumeHomeExpansion()).toEqual({ topicId: 't1', partIndex: 3 })
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('Reinforcement words', () => {
    it("folds this Part's 2 reinforcement words into the Reading/Listen-and-write pool, without adding intro pages for them", async () => {
      const { wrapper } = await mountFlowWithTwoParts('1', REINFORCEMENT_WORD_IDS)
      try {
        // Sequence length is still new-words-only (5*3 + reading + listen-write
        // = 17) — reinforcement words never get word-intro pages.
        for (let i = 0; i < 15; i++) {
          await clickNext(wrapper, WORD_BY_CUE_TWO_PARTS)
        }
        expect(wrapper.find('.reading-page').exists()).toBe(true)
        // 5 new words + this part's 2 reinforcement words (rw1, rw2).
        expect(wrapper.get('.reading-page-counter').text()).toBe('1 / 7')

        await clickNext(wrapper, WORD_BY_CUE_TWO_PARTS)
        expect(wrapper.get('#dictation-counter').text()).toBe('1 / 7')
      } finally {
        wrapper.unmount()
      }
    })

    it('the dedicated Review part has no word-intro pages — just Reading/Listen-and-write over the leftover reinforcement words', async () => {
      const { wrapper } = await mountFlowWithTwoParts('review', REINFORCEMENT_WORD_IDS)
      try {
        // Leftover once both numbered parts claimed their 2: rw5, rw6, rw7.
        expect(wrapper.find('.word-page-1').exists()).toBe(false)
        expect(wrapper.find('.reading-page').exists()).toBe(true)
        expect(wrapper.get('.reading-page-counter').text()).toBe('1 / 3')
        expect(wrapper.get('.flow-progress-fill').attributes('style')).toContain(`width: ${(1 / 2) * 100}%`)

        await wrapper.get('.flow-next-btn').trigger('click')
        expect(wrapper.get('#dictation-counter').text()).toBe('1 / 3')
        expect(wrapper.get('.flow-next-btn').text()).toBe('Finish')
      } finally {
        wrapper.unmount()
      }
    })
  })
})
