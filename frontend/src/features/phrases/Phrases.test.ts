import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { resetUserWordsStoreForTests } from '../../shared/userWords'
import Phrases from './Phrases.vue'

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return {
    ...actual,
    getUserWords: vi.fn(),
  }
})

function word(id: string, original: string, gender = 'not_apply') {
  return {
    word_id: id,
    original,
    filename: `${original}.webp`,
    sentence: '',
    cue: '',
    gender_id: gender,
    confident: false,
    shown_count: 0,
    show: true,
  }
}

const PADRE = word('wd-0001', 'padre', 'masculine')
const MADRE = word('wd-0002', 'madre', 'feminine')
const HIJO = word('wd-0003', 'hijo', 'masculine')
const HIJA = word('wd-0004', 'hija', 'feminine')
const HERMANO = word('wd-0005', 'hermano', 'masculine')
const HERMANA = word('wd-0006', 'hermana', 'feminine')
const ABUELO = word('wd-0007', 'abuelo', 'masculine')
const ABUELA = word('wd-0008', 'abuela', 'feminine')
const TIO = word('wd-0009', 'tío', 'masculine')

const ALL_WORDS = [PADRE, MADRE, HIJO, HIJA, HERMANO, HERMANA, ABUELO, ABUELA, TIO]

const TOPIC = {
  word_ids: ['wd-0001', 'wd-0002', 'wd-0003', 'wd-0004', 'wd-0005', 'wd-0006', 'wd-0007', 'wd-0008'],
  phrases: [
    { id: 'sent-1', sentence: 'Mi padre y mi madre viajan juntos.', word_ids: ['wd-0001', 'wd-0002'] },
  ],
}

const EARLIER_TOPIC = {
  word_ids: ['wd-0009'],
  phrases: [{ id: 'sent-r1', sentence: 'Mi tío llegó tarde.', word_ids: ['wd-0009'] }],
}

const ALL_CHAPTERS = [{ topics: [EARLIER_TOPIC, TOPIC] }]

// Same trick used across Reading/Dictation/Quiz's own tests: pinning
// Math.random just under 1 makes the Fisher-Yates shuffle's swap index
// always equal the current index, a same-index no-op — every pre-shuffle
// insertion order (correct words first, then the distractor pool in
// topic.word_ids order) survives intact so tests can assert exact option
// order/labels.
const NO_SHUFFLE_RANDOM = 0.999999

function options(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll<HTMLButtonElement>('.phrase-option')
}

function findOptionByText(wrapper: ReturnType<typeof mount>, text: string) {
  const found = options(wrapper).find((o) => o.find('.phrase-option-label').text() === text)
  if (!found) throw new Error(`no phrase option with text "${text}"`)
  return found
}

describe('Phrases', () => {
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

  it('shows the empty state when the topic has no usable phrases', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: ALL_WORDS })

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', { word_ids: [], phrases: [] })

      expect(wrapper.find<HTMLElement>('#phrases-empty-state').element.style.display).toBe('block')
      expect(wrapper.find<HTMLElement>('#phrases-stage').element.style.display).toBe('none')
    } finally {
      wrapper.unmount()
    }
  })

  it('renders instantly from a cached word list and refreshes in the background', async () => {
    writeCache(cacheKey('user-words', 'test@example.com', 'pt-es', 'target', 'origin'), ALL_WORDS)
    vi.mocked(api.getUserWords).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      expect(wrapper.find<HTMLElement>('#phrases-stage').element.style.display).toBe('flex')
      expect(wrapper.find('#phrases-counter').text()).toBe('1 / 1')
    } finally {
      wrapper.unmount()
    }
  })

  it('builds 8 options: the correct words first, padded with topic distractors', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: ALL_WORDS })

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      const labels = options(wrapper).map((o) => o.find('.phrase-option-label').text())
      expect(labels).toEqual(['padre', 'madre', 'hijo', 'hija', 'hermano', 'hermana', 'abuelo', 'abuela']);
      for (const opt of options(wrapper)) {
        expect(opt.classes()).toContain('dimmed')
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('tapping the correct words in order badges them and un-dims them, then completes and auto-advances after 1s', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: ALL_WORDS })

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      await findOptionByText(wrapper, 'padre').trigger('click')
      expect(findOptionByText(wrapper, 'padre').classes()).not.toContain('dimmed')
      expect(findOptionByText(wrapper, 'padre').find('.phrase-option-order-badge').text()).toBe('1')

      await findOptionByText(wrapper, 'madre').trigger('click')
      expect(findOptionByText(wrapper, 'madre').find('.phrase-option-order-badge').text()).toBe('2')
      expect(findOptionByText(wrapper, 'padre').classes()).toContain('phrase-option-correct')
      expect(findOptionByText(wrapper, 'madre').classes()).toContain('phrase-option-correct')

      // single-phrase topic: advancing wraps back to the same round
      await vi.advanceTimersByTimeAsync(999)
      expect(wrapper.find('#phrases-counter').text()).toBe('1 / 1')
      await vi.advanceTimersByTimeAsync(1)
      // a fresh round was loaded — the previous selection state is reset
      expect(findOptionByText(wrapper, 'padre').classes()).toContain('dimmed')
      expect(findOptionByText(wrapper, 'padre').classes()).not.toContain('phrase-option-correct')
    } finally {
      wrapper.unmount()
    }
  })

  it('a wrong tap locks the round, reveals the filled sentence, and shows Proceed instead of auto-advancing', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: ALL_WORDS })

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      await findOptionByText(wrapper, 'hijo').trigger('click')

      expect(findOptionByText(wrapper, 'hijo').classes()).toContain('phrase-option-wrong')
      expect(wrapper.find<HTMLElement>('#phrase-audio-btn').element.style.display).toBe('none')
      expect(wrapper.find<HTMLElement>('#phrase-sentence-display').element.style.display).toBe('block')
      expect(wrapper.find<HTMLElement>('#phrase-proceed-btn').element.style.display).toBe('flex')

      await vi.advanceTimersByTimeAsync(5000)
      expect(wrapper.find('#phrases-counter').text()).toBe('1 / 1')

      await wrapper.find('#phrase-proceed-btn').trigger('click')
      expect(wrapper.find<HTMLElement>('#phrase-proceed-btn').element.style.display).toBe('none')
      expect(wrapper.find<HTMLElement>('#phrase-audio-btn').element.style.display).toBe('flex')
    } finally {
      wrapper.unmount()
    }
  })

  it('further taps are ignored once a round has locked (correct or wrong)', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: ALL_WORDS })

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      await findOptionByText(wrapper, 'hijo').trigger('click') // wrong, locks
      await findOptionByText(wrapper, 'padre').trigger('click') // ignored

      expect(findOptionByText(wrapper, 'padre').find('.phrase-option-order-badge').text()).toBe('')
    } finally {
      wrapper.unmount()
    }
  })

  it('pause() cancels a pending auto-advance', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: ALL_WORDS })

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
      await findOptionByText(wrapper, 'padre').trigger('click')
      await findOptionByText(wrapper, 'madre').trigger('click')

      wrapper.vm.pause()
      await vi.advanceTimersByTimeAsync(2000)

      expect(findOptionByText(wrapper, 'padre').classes()).toContain('phrase-option-correct')
    } finally {
      wrapper.unmount()
    }
  })

  it('pulls a reinforcement word into its own round, sourced from the topic that actually teaches it', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: ALL_WORDS })

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC, undefined, undefined, ALL_CHAPTERS, ['wd-0009'])

      expect(wrapper.find('#phrases-counter').text()).toBe('1 / 2')
    } finally {
      wrapper.unmount()
    }
  })

  it('marks a reinforcement word option with the 💪 badge', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: ALL_WORDS })

    const wrapper = mount(Phrases, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC, undefined, undefined, ALL_CHAPTERS, ['wd-0009'])

      // With Math.random pinned (no-shuffle), round 1 is the topic's own
      // padre/madre phrase and tío isn't among its 8 options at all (the
      // distractor pool is capped before reaching it) — complete round 1
      // to advance into round 2, the reinforcement round pulled from tío's
      // own topic.
      await findOptionByText(wrapper, 'padre').trigger('click')
      await findOptionByText(wrapper, 'madre').trigger('click')
      await vi.advanceTimersByTimeAsync(1000)

      expect(wrapper.find('#phrases-counter').text()).toBe('2 / 2')
      expect(findOptionByText(wrapper, 'tío').find('.reinforcement-badge').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})
