import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { resetUserWordsStoreForTests } from '../../shared/userWords'
import Reading from './Reading.vue'

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return {
    ...actual,
    getUserWords: vi.fn(),
  }
})

const HELLO = {
  word_id: 'wd-0001',
  original: 'hello',
  filename: 'hello.webp',
  sentence: '',
  cue: '',
  gender_id: 'not_apply',
  particle_type: 'not_apply',
  confident: false,
  shown_count: 0,
  show: true,
}
const FATHER = { ...HELLO, word_id: 'wd-0002', original: 'father', gender_id: 'masculine' }
const CONFIDENT_WORD = { ...HELLO, word_id: 'wd-0003', original: 'goodbye', confident: true }
const HIDDEN_WORD = { ...HELLO, word_id: 'wd-0004', original: 'known', show: false }

const TOPIC = { word_ids: ['wd-0001', 'wd-0002', 'wd-0003', 'wd-0004'] }

function currentWord(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('#reading-word')
}

// Every #reading-* id is a fixed DOM id (see Reading.vue), and mount()
// attaches to the real document.body — a wrapper left mounted after a
// failed assertion would leak its stale elements into the next test's
// document.getElementById lookups, so try/finally guarantees unmount runs
// either way (same defensive pattern as Texts.test.ts).

// Reading.vue reshuffles its word list on every load via Math.random() (see
// its shuffle() helper), so tests that assert a specific word/position pin
// Math.random to a constant just under 1 — for shuffle's
// `j = floor(random * (i + 1))`, that always yields j === i, i.e. every
// swap is a same-index no-op, leaving the pre-shuffle (filtered, word_ids)
// order intact. The dedicated shuffling test below overrides this per-call
// to prove the order actually changes with different random values.
const NO_SHUFFLE_RANDOM = 0.999999

describe('Reading', () => {
  beforeEach(() => {
    localStorage.clear()
    resetUserWordsStoreForTests()
    vi.mocked(api.getUserWords).mockReset()
    vi.spyOn(Math, 'random').mockReturnValue(NO_SHUFFLE_RANDOM)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows only the topic\'s learning words (not confident, not hidden), in word_ids order', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({
      lang: 'pt-es',
      words: [CONFIDENT_WORD, HIDDEN_WORD, FATHER, HELLO],
    })

    const wrapper = mount(Reading, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      expect(currentWord(wrapper).text()).toBe('hello')
      expect(wrapper.find('#reading-counter').text()).toBe('1 / 2')
    } finally {
      wrapper.unmount()
    }
  })

  it('a reinforcement word bypasses both the confident and hidden (show=false) filters', async () => {
    // Reinforcement words are pulled from earlier topics a user has
    // typically already finished — and thus already marked confident/known
    // (hidden) in Flashcards — so a real reinforcement candidate is usually
    // exactly this shape. Regression test for a bug where the show!==false
    // check (meant for the topic's own words) was also applied to
    // reinforcement entries, silently excluding almost all of them.
    const REINFORCED_KNOWN = { ...HELLO, word_id: 'wd-0005', original: 'reinforced', confident: true, show: false }
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HELLO, REINFORCED_KNOWN] })

    const wrapper = mount(Reading, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC, undefined, undefined, ['wd-0005'])

      expect(wrapper.find('#reading-counter').text()).toBe('1 / 2')
      await wrapper.find('#reading-word-area').trigger('click')
      expect(currentWord(wrapper).text()).toBe('reinforced')
      expect(wrapper.find<HTMLElement>('#reading-reinforcement-badge').element.style.display).toBe('flex')
    } finally {
      wrapper.unmount()
    }
  })

  it('advances to the next word on click, wrapping back to the first', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HELLO, FATHER] })

    const wrapper = mount(Reading, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      await wrapper.find('#reading-word-area').trigger('click')
      expect(currentWord(wrapper).text()).toBe('|father') // masculine gender prefix, see genders.ts
      expect(wrapper.find('#reading-counter').text()).toBe('2 / 2')

      await wrapper.find('#reading-word-area').trigger('click')
      expect(currentWord(wrapper).text()).toBe('hello')
      expect(wrapper.find('#reading-counter').text()).toBe('1 / 2')
    } finally {
      wrapper.unmount()
    }
  })

  it('decorates a gendered word the same way Flashcards does', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [FATHER] })

    const wrapper = mount(Reading, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      const wordEl = currentWord(wrapper)
      expect(wordEl.text()).toBe('|father')
      expect((wordEl.element as HTMLElement).style.color).toBe('rgb(79, 140, 255)')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows the empty state when the topic has no learning words', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [CONFIDENT_WORD, HIDDEN_WORD] })

    const wrapper = mount(Reading, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      // Not isVisible(): the outer #topic-reading-panel starts with
      // style="display:none" in the template (the shell only shows it once
      // the Reading tab is active, which this isolated test never
      // simulates), so ancestor-aware visibility checks would always read
      // false here regardless of this component's own logic. Check the
      // style this component actually sets instead.
      expect(wrapper.find<HTMLElement>('#reading-empty-state').element.style.display).toBe('block')
      expect(wrapper.find<HTMLElement>('#reading-stage').element.style.display).toBe('none')
    } finally {
      wrapper.unmount()
    }
  })

  it('renders instantly from a cached word list and refreshes in the background', async () => {
    writeCache(cacheKey('user-words', 'test@example.com', 'pt-es', 'target', 'origin'), [HELLO])
    vi.mocked(api.getUserWords).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(Reading, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      expect(currentWord(wrapper).text()).toBe('hello')
      expect(api.getUserWords).toHaveBeenCalledWith('test@example.com', 'pt-es', 'target', 'origin')
    } finally {
      wrapper.unmount()
    }
  })

  it('reshuffles the word order on every load, not just once from the topic\'s word_ids order', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HELLO, FATHER] })

    const wrapper = mount(Reading, { attachTo: document.body })
    try {
      // Math.random() pinned to NO_SHUFFLE_RANDOM in beforeEach leaves the
      // word_ids order ([HELLO, FATHER]) intact for this first load.
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
      expect(currentWord(wrapper).text()).toBe('hello')

      // A different random value swaps the (only) pair on this second
      // load — same topic, same underlying data, freshly reshuffled.
      vi.mocked(Math.random).mockReturnValue(0)
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
      expect(currentWord(wrapper).text()).toBe('|father')
    } finally {
      wrapper.unmount()
    }
  })
})
