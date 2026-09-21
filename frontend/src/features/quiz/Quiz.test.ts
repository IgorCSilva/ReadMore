import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { resetUserWordsStoreForTests } from '../../shared/userWords'
import Quiz from './Quiz.vue'

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return {
    ...actual,
    getUserWords: vi.fn(),
  }
})

const POTATO = {
  word_id: 'wd-0001',
  original: 'potato',
  filename: 'potato.webp',
  sentence: '',
  cue: 'a starchy vegetable',
  gender_id: 'not_apply',
  confident: false,
  shown_count: 0,
  show: true,
}
const STRAW = { ...POTATO, word_id: 'wd-0002', original: 'straw', cue: 'drinking straw' }
const BREAD = { ...POTATO, word_id: 'wd-0003', original: 'bread', cue: 'baked from flour' }
const EGG = { ...POTATO, word_id: 'wd-0004', original: 'egg', cue: 'laid by a hen' }
const CONFIDENT_WORD = { ...POTATO, word_id: 'wd-0005', original: 'goodbye', confident: true }
const HIDDEN_WORD = { ...POTATO, word_id: 'wd-0006', original: 'known', show: false }

const TOPIC = { word_ids: ['wd-0001', 'wd-0002', 'wd-0003', 'wd-0004', 'wd-0005', 'wd-0006'] }

// Reading.vue-style trick: shuffle's `j = floor(random * (i + 1))` always
// yields j === i (a same-index no-op swap) when random is pinned just under
// 1, leaving every pre-shuffle order intact so tests can assert exact
// positions/labels.
const NO_SHUFFLE_RANDOM = 0.999999

function options(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll<HTMLButtonElement>('.quiz-option')
}

function findOptionByText(wrapper: ReturnType<typeof mount>, text: string) {
  const found = options(wrapper).find((o) => o.text() === text)
  if (!found) throw new Error(`no quiz option with text "${text}"`)
  return found
}

// Every #quiz-* id is a fixed DOM id (see Quiz.vue), and mount() attaches to
// the real document.body — a wrapper left mounted after a failed assertion
// would leak its stale elements into the next test's document.getElementById
// lookups, so try/finally guarantees unmount runs either way (same
// defensive pattern as Dictation.test.ts).

describe('Quiz', () => {
  beforeEach(() => {
    localStorage.clear()
    resetUserWordsStoreForTests()
    vi.mocked(api.getUserWords).mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(NO_SHUFFLE_RANDOM)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows the empty state when the topic has fewer than two learning words', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, CONFIDENT_WORD, HIDDEN_WORD] })

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      expect(wrapper.find<HTMLElement>('#quiz-empty-state').element.style.display).toBe('block')
      expect(wrapper.find<HTMLElement>('#quiz-stage').element.style.display).toBe('none')
    } finally {
      wrapper.unmount()
    }
  })

  it('reinforcement words bypass both the confident and hidden (show=false) filters', async () => {
    // Reinforcement words are pulled from earlier topics a user has
    // typically already finished — and thus already marked confident/known
    // (hidden) in Flashcards — so a real reinforcement candidate is usually
    // exactly this shape. Regression test for a bug where the show!==false
    // check (meant for the topic's own words) was also applied to
    // reinforcement entries, silently excluding almost all of them.
    const REINFORCED_A = { ...POTATO, word_id: 'wd-0007', original: 'reinforced-a', confident: true, show: false }
    const REINFORCED_B = { ...POTATO, word_id: 'wd-0008', original: 'reinforced-b', confident: true, show: false }
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [REINFORCED_A, REINFORCED_B] })

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', { word_ids: [] }, undefined, undefined, ['wd-0007', 'wd-0008'])

      expect(wrapper.find<HTMLElement>('#quiz-empty-state').element.style.display).toBe('none')
      expect(wrapper.find('#quiz-counter').text()).toBe('1 / 2')
      expect(wrapper.find('.reinforcement-badge').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('renders instantly from a cached word list and refreshes in the background', async () => {
    writeCache(cacheKey('user-words', 'test@example.com', 'pt-es', 'target', 'origin'), [POTATO, STRAW])
    vi.mocked(api.getUserWords).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      expect(wrapper.find<HTMLElement>('#quiz-stage').element.style.display).toBe('flex')
      expect(wrapper.find('#quiz-counter').text()).toBe('1 / 2')
      expect(api.getUserWords).toHaveBeenCalledWith('test@example.com', 'pt-es', 'target', 'origin')
    } finally {
      wrapper.unmount()
    }
  })

  it('renders four options, one per distinct word, with the pictured word among them', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, STRAW, BREAD, EGG] })

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      const labels = options(wrapper).map((o) => o.text())
      expect(labels).toHaveLength(4)
      expect(new Set(labels).size).toBe(4)
      expect(labels).toContain('potato')
    } finally {
      wrapper.unmount()
    }
  })

  it('marks the right pick with the accent-colored correct style and disables every option', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, STRAW, BREAD, EGG] })

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      await findOptionByText(wrapper, 'potato').trigger('click')

      expect(findOptionByText(wrapper, 'potato').classes()).toContain('quiz-option-correct')
      for (const opt of options(wrapper)) {
        expect(opt.element.disabled).toBe(true)
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('marks a wrong pick red and reveals the right answer in the confident-green style', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, STRAW, BREAD, EGG] })

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      const wrongPick = options(wrapper).find((o) => o.text() !== 'potato')!
      await wrongPick.trigger('click')

      expect(wrongPick.classes()).toContain('quiz-option-wrong')
      expect(findOptionByText(wrapper, 'potato').classes()).toContain('quiz-option-reveal')
    } finally {
      wrapper.unmount()
    }
  })

  it('ignores further clicks once a pick has locked in the round', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, STRAW, BREAD, EGG] })

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      const wrongPick = options(wrapper).find((o) => o.text() !== 'potato')!
      await wrongPick.trigger('click')
      await findOptionByText(wrapper, 'potato').trigger('click')

      // The correct button already carries "reveal" (green, from the wrong
      // pick above) — a late click on it must not additionally mark it
      // "correct" (accent), since the round was already decided.
      expect(findOptionByText(wrapper, 'potato').classes()).not.toContain('quiz-option-correct')
    } finally {
      wrapper.unmount()
    }
  })

  it('auto-advances to the next question 1s after a pick', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, STRAW, BREAD, EGG] })

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
      await findOptionByText(wrapper, 'potato').trigger('click')

      await vi.advanceTimersByTimeAsync(999)
      expect(wrapper.find('#quiz-counter').text()).toBe('1 / 4')

      await vi.advanceTimersByTimeAsync(1)
      expect(wrapper.find('#quiz-counter').text()).toBe('2 / 4')
      for (const opt of options(wrapper)) {
        expect(opt.element.disabled).toBe(false)
        expect(opt.classes()).not.toContain('quiz-option-correct')
        expect(opt.classes()).not.toContain('quiz-option-wrong')
        expect(opt.classes()).not.toContain('quiz-option-reveal')
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('pause() cancels a pending auto-advance', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, STRAW, BREAD, EGG] })

    const wrapper = mount(Quiz, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
      await findOptionByText(wrapper, 'potato').trigger('click')

      wrapper.vm.pause()
      await vi.advanceTimersByTimeAsync(2000)

      expect(wrapper.find('#quiz-counter').text()).toBe('1 / 4')
    } finally {
      wrapper.unmount()
    }
  })
})
