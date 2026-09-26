import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import { resetUserWordsStoreForTests } from '../../shared/userWords'
import Dictation from './Dictation.vue'

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
  cue: '',
  gender_id: 'not_apply',
  particle_type: 'not_apply',
  confident: false,
  shown_count: 0,
  show: true,
}
const STRAW = { ...POTATO, word_id: 'wd-0002', original: 'straw' }
const CONFIDENT_WORD = { ...POTATO, word_id: 'wd-0003', original: 'goodbye', confident: true }
const HIDDEN_WORD = { ...POTATO, word_id: 'wd-0004', original: 'known', show: false }

const TOPIC = { word_ids: ['wd-0001', 'wd-0002', 'wd-0003', 'wd-0004'] }

// Reading.vue-style trick: shuffle's `j = floor(random * (i + 1))` always
// yields j === i (a same-index no-op swap) when random is pinned just under
// 1, leaving the pre-shuffle (word_ids) order intact so tests can assert a
// specific word/position.
const NO_SHUFFLE_RANDOM = 0.999999

function input(wrapper: ReturnType<typeof mount>) {
  return wrapper.find<HTMLInputElement>('#dictation-input')
}

async function typeWord(wrapper: ReturnType<typeof mount>, text: string) {
  await input(wrapper).setValue(text)
}

async function check(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('#dictation-check-btn').trigger('click')
}

function diffSpans(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('#dictation-result-word span').map((s) => ({
    text: s.element.textContent,
    type: s.classes().find((c) => c.startsWith('dictation-letter-'))?.replace('dictation-letter-', ''),
  }))
}

// Every #dictation-* id is a fixed DOM id (see Dictation.vue), and mount()
// attaches to the real document.body — a wrapper left mounted after a
// failed assertion would leak its stale elements into the next test's
// document.getElementById lookups, so try/finally guarantees unmount runs
// either way (same defensive pattern as Reading.test.ts/Typing.test.ts).

describe('Dictation', () => {
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

  it('shows the empty state when the topic has no learning words', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [CONFIDENT_WORD, HIDDEN_WORD] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      expect(wrapper.find<HTMLElement>('#dictation-empty-state').element.style.display).toBe('block')
      expect(wrapper.find<HTMLElement>('#dictation-stage').element.style.display).toBe('none')
    } finally {
      wrapper.unmount()
    }
  })

  it('renders instantly from a cached word list and refreshes in the background', async () => {
    writeCache(cacheKey('user-words', 'test@example.com', 'pt-es', 'target', 'origin'), [POTATO])
    vi.mocked(api.getUserWords).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      expect(wrapper.find<HTMLElement>('#dictation-stage').element.style.display).toBe('flex')
      expect(wrapper.find('#dictation-counter').text()).toBe('1 / 1')
      expect(api.getUserWords).toHaveBeenCalledWith('test@example.com', 'pt-es', 'target', 'origin')
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
    const REINFORCED_KNOWN = { ...POTATO, word_id: 'wd-0005', original: 'reinforced', confident: true, show: false }
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [REINFORCED_KNOWN] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', { word_ids: [] }, undefined, undefined, ['wd-0005'])

      expect(wrapper.find('#dictation-counter').text()).toBe('1 / 1')
      await typeWord(wrapper, 'reinforced')
      await check(wrapper)

      expect(wrapper.find<HTMLElement>('#dictation-reinforcement-badge').element.style.display).toBe('flex')
    } finally {
      wrapper.unmount()
    }
  })

  it('marks a fully correct guess with the target-color class on every letter, hides the audio button, and disables the check button', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      await typeWord(wrapper, 'potato')
      await check(wrapper)

      expect(diffSpans(wrapper)).toEqual(
        [...'potato'].map((text) => ({ text, type: 'correct' })),
      )
      expect(wrapper.find<HTMLElement>('#dictation-audio-btn').element.style.display).toBe('none')
      expect(wrapper.find<HTMLButtonElement>('#dictation-check-btn').element.disabled).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('auto-advances to the next word 1s after a fully correct guess', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, STRAW] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
      await typeWord(wrapper, 'potato')
      await check(wrapper)

      await vi.advanceTimersByTimeAsync(999)
      expect(wrapper.find('#dictation-counter').text()).toBe('1 / 2')

      await vi.advanceTimersByTimeAsync(1)
      expect(wrapper.find('#dictation-counter').text()).toBe('2 / 2')
      expect(input(wrapper).element.value).toBe('')
      expect(wrapper.find<HTMLElement>('#dictation-audio-btn').element.style.display).toBe('flex')
      expect(wrapper.find<HTMLButtonElement>('#dictation-check-btn').element.disabled).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps the check button active and the typed text untouched after a wrong guess', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
      await typeWord(wrapper, 'xx')
      await check(wrapper)

      expect(wrapper.find<HTMLButtonElement>('#dictation-check-btn').element.disabled).toBe(false)
      expect(input(wrapper).element.value).toBe('xx')
    } finally {
      wrapper.unmount()
    }
  })

  it('aligns a missing middle letter instead of flagging every letter after it as wrong', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      // "poato" is "potato" missing the first "t" — everything the user did
      // type is still in the right relative order, so only that one letter
      // should read as missing, not a cascade of "wrong" letters after it
      // (regression: a naive index-by-index compare misaligns everything
      // past the gap).
      await typeWord(wrapper, 'poato')
      await check(wrapper)

      expect(diffSpans(wrapper)).toEqual([
        { text: 'p', type: 'correct' },
        { text: 'o', type: 'correct' },
        { text: 't', type: 'missing' },
        { text: 'a', type: 'correct' },
        { text: 't', type: 'correct' },
        { text: 'o', type: 'correct' },
      ])
    } finally {
      wrapper.unmount()
    }
  })

  it('flags a genuinely extra letter as wrong without disturbing the letters around it', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      // "pottato" has one extra "t" not in "potato".
      await typeWord(wrapper, 'pottato')
      await check(wrapper)

      expect(diffSpans(wrapper)).toEqual([
        { text: 'p', type: 'correct' },
        { text: 'o', type: 'correct' },
        { text: 't', type: 'wrong' },
        { text: 't', type: 'correct' },
        { text: 'a', type: 'correct' },
        { text: 't', type: 'correct' },
        { text: 'o', type: 'correct' },
      ])
    } finally {
      wrapper.unmount()
    }
  })

  it('flags extra leading spaces visibly instead of letting them render as invisible blanks', async () => {
    const ES = { ...POTATO, original: 'es' }
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [ES] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      // A plain " " has no visible glyph — colored red or gray, it would
      // vanish against the page background, so a wrong/extra space needs a
      // visible stand-in (see VISIBLE_SPACE in Dictation.vue) to actually be
      // seen as an error rather than just silently absent from the diff.
      await typeWord(wrapper, '   es')
      await check(wrapper)

      expect(diffSpans(wrapper)).toEqual([
        { text: '␣', type: 'wrong' },
        { text: '␣', type: 'wrong' },
        { text: '␣', type: 'wrong' },
        { text: 'e', type: 'correct' },
        { text: 's', type: 'correct' },
      ])
    } finally {
      wrapper.unmount()
    }
  })

  it('pause() cancels a pending auto-advance', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [POTATO, STRAW] })

    const wrapper = mount(Dictation, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
      await typeWord(wrapper, 'potato')
      await check(wrapper)

      wrapper.vm.pause()
      await vi.advanceTimersByTimeAsync(2000)

      expect(wrapper.find('#dictation-counter').text()).toBe('1 / 2')
    } finally {
      wrapper.unmount()
    }
  })
})
