import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { cacheKey, writeCache } from '../../shared/cache'
import Typing from './Typing.vue'

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return {
    ...actual,
    getUserWords: vi.fn(),
  }
})

const HOLA = {
  word_id: 'wd-0001',
  original: 'hola',
  filename: 'hola.webp',
  sentence: '',
  cue: '',
  gender_id: 'not_apply',
  confident: false,
  shown_count: 0,
  show: true,
}
const DIA = { ...HOLA, word_id: 'wd-0002', original: 'día' }
const CONFIDENT_WORD = { ...HOLA, word_id: 'wd-0003', original: 'goodbye', confident: true }
const HIDDEN_WORD = { ...HOLA, word_id: 'wd-0004', original: 'known', show: false }

const TOPIC = { word_ids: ['wd-0001', 'wd-0002', 'wd-0003', 'wd-0004'] }

function capture(wrapper: ReturnType<typeof mount>) {
  return wrapper.find<HTMLInputElement>('#typing-key-capture').element
}

function fireInput(el: HTMLInputElement, data: string) {
  el.dispatchEvent(new InputEvent('input', { data, inputType: 'insertText', bubbles: true }))
}

function fireComposition(el: HTMLInputElement, type: string, data?: string) {
  el.dispatchEvent(new CompositionEvent(type, { data, bubbles: true }))
}

// Every #typing-* id is a fixed DOM id (see Typing.vue), and mount() attaches
// to the real document.body — a wrapper left mounted after a failed
// assertion would leak its stale elements into the next test's
// document.getElementById lookups, so try/finally guarantees unmount runs
// either way (same defensive pattern as Reading.test.ts/Texts.test.ts).

describe('Typing', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(api.getUserWords).mockReset()
    // jsdom's getBoundingClientRect is always zero-size by default, which
    // would make the "danger zone" (a fraction of stage width) and spawn
    // starting position (stage width + a margin) both meaningless/zero —
    // pin a realistic size, same technique Flashcards.test.ts uses for its
    // swipe-threshold tests.
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 400,
    } as DOMRect)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows the empty state when the topic has no learning words', async () => {
    vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [CONFIDENT_WORD, HIDDEN_WORD] })

    const wrapper = mount(Typing, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      // Not isVisible(): the outer #topic-typing-panel starts with
      // style="display:none" in the template (the shell only shows it once
      // the Typing tab is active, which this isolated test never
      // simulates), so ancestor-aware visibility checks would always read
      // false here regardless of this component's own logic.
      expect(wrapper.find<HTMLElement>('#typing-empty-state').element.style.display).toBe('block')
      expect(wrapper.find<HTMLElement>('#typing-stage').element.style.display).toBe('none')
    } finally {
      wrapper.unmount()
    }
  })

  it('renders instantly from a cached word list and refreshes in the background', async () => {
    writeCache(cacheKey('user-words', 'test@example.com', 'pt-es', 'target', 'origin'), [HOLA])
    vi.mocked(api.getUserWords).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(Typing, { attachTo: document.body })
    try {
      await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

      expect(wrapper.find<HTMLElement>('#typing-stage').element.style.display).toBe('flex')
      expect(wrapper.find<HTMLElement>('#typing-empty-state').element.style.display).toBe('none')
      expect(api.getUserWords).toHaveBeenCalledWith('test@example.com', 'pt-es', 'target', 'origin')
    } finally {
      wrapper.unmount()
    }
  })

  describe('live round', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // Pins word/lane/speed/spawn-delay randomness so a spawn happens on a
      // known schedule — with a single-word pool, which exact word/lane is
      // picked doesn't matter, only that the timer counts down predictably.
      vi.spyOn(Math, 'random').mockReturnValue(0)
    })

    it('locks onto a spawned word by its first letter and completes it on the last', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HOLA] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

        // scheduleSpawn() picks a 0.5s-1.6s delay (0.5s with random pinned
        // to 0) — advancing past that lets the rAF loop spawn one flyer.
        await vi.advanceTimersByTimeAsync(700)
        expect(wrapper.findAll('.typing-flyer')).toHaveLength(1)
        expect(wrapper.findAll('.typing-letter').map((l) => l.text())).toEqual(['h', 'o', 'l', 'a'])
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(0)

        const input = capture(wrapper)
        fireInput(input, 'h')
        fireInput(input, 'o')
        fireInput(input, 'l')
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(3)
        expect(wrapper.find('.typing-flyer').classes()).not.toContain('done')

        fireInput(input, 'a')
        expect(wrapper.find('.typing-flyer').classes()).toContain('done')
        expect(wrapper.find('#typing-hud-caught').text()).toBe('1')
      } finally {
        wrapper.unmount()
      }
    })

    it('ignores a wrong key and does not advance or lock', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HOLA] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
        await vi.advanceTimersByTimeAsync(700)

        fireInput(capture(wrapper), 'z') // matches no word's first letter
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(0)

        fireInput(capture(wrapper), 'h')
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(1)
      } finally {
        wrapper.unmount()
      }
    })

    it('completes a word typed through a dead-key accent composition (´ then i -> í)', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [DIA] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
        await vi.advanceTimersByTimeAsync(700)
        expect(wrapper.findAll('.typing-letter').map((l) => l.text())).toEqual(['d', 'í', 'a'])

        const input = capture(wrapper)
        fireInput(input, 'd')
        // The dead key itself commits no data — only the composition
        // sequence's end does, once "i" resolves it into "í".
        fireComposition(input, 'compositionstart')
        fireComposition(input, 'compositionend', 'í')
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(2)

        fireInput(input, 'a')
        expect(wrapper.find('.typing-flyer').classes()).toContain('done')
      } finally {
        wrapper.unmount()
      }
    })

    it('rejects a plain "o" for an accented "ó" — accents are not stripped', async () => {
      const COMO = { ...HOLA, word_id: 'wd-0005', original: 'cómo' }
      const topicWithComo = { word_ids: [...TOPIC.word_ids, 'wd-0005'] }
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [COMO] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', topicWithComo)
        await vi.advanceTimersByTimeAsync(700)

        const input = capture(wrapper)
        fireInput(input, 'c')
        fireInput(input, 'o') // wrong: word needs "ó" next, not "o"
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(1)

        fireComposition(input, 'compositionend', 'ó')
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(2)
      } finally {
        wrapper.unmount()
      }
    })

    it('misses a word that reaches the danger line before it is finished', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HOLA] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)

        // Stage width pinned to 640, speed pinned to its minimum (34px/s
        // with random=0): a flyer starts at x = 680 and the danger line
        // sits at 640*0.11 ≈ 70, so ~18s covers the full crossing for
        // whichever flyer spawns first, with room to spare.
        await vi.advanceTimersByTimeAsync(20000)

        expect(wrapper.find('#typing-hud-missed').text()).not.toBe('0')
        expect(wrapper.find('#typing-hud-caught').text()).toBe('0')
      } finally {
        wrapper.unmount()
      }
    })

    it('pause() stops spawning and movement until show() runs again', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HOLA] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
        await vi.advanceTimersByTimeAsync(700)
        const countAfterFirstSpawn = wrapper.findAll('.typing-flyer').length
        expect(countAfterFirstSpawn).toBeGreaterThan(0)

        wrapper.vm.pause()
        await vi.advanceTimersByTimeAsync(5000)

        expect(wrapper.findAll('.typing-flyer')).toHaveLength(countAfterFirstSpawn)
      } finally {
        wrapper.unmount()
      }
    })

    it('types a multi-word target through the space bar, letter by letter including the space', async () => {
      const DE_NADA = { ...HOLA, word_id: 'wd-0005', original: 'de nada' }
      const topicWithDeNada = { word_ids: [...TOPIC.word_ids, 'wd-0005'] }
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [DE_NADA] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', topicWithDeNada)
        await vi.advanceTimersByTimeAsync(700)

        // One letter span per character, space included — this is also
        // what CSS's white-space: pre keeps from collapsing away visually
        // (see App.vue's .typing-letter rule). Not .text(): @vue/test-utils
        // trims that, which would silently turn the space assertion into a
        // no-op — read the raw DOM textContent instead.
        expect(wrapper.findAll('.typing-letter').map((l) => l.element.textContent)).toEqual([
          'd', 'e', ' ', 'n', 'a', 'd', 'a',
        ])

        const input = capture(wrapper)
        for (const ch of 'de') fireInput(input, ch)
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(2)

        fireInput(input, ' ')
        expect(wrapper.findAll('.typing-letter.typed')).toHaveLength(3)

        for (const ch of 'nada') fireInput(input, ch)
        expect(wrapper.find('.typing-flyer').classes()).toContain('done')
        expect(wrapper.find('#typing-hud-caught').text()).toBe('1')
      } finally {
        wrapper.unmount()
      }
    })

    it('Reset clears the board and score and starts a fresh round in place', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HOLA] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
        await vi.advanceTimersByTimeAsync(700)

        const input = capture(wrapper)
        for (const ch of 'hola') fireInput(input, ch)
        expect(wrapper.find('#typing-hud-caught').text()).toBe('1')

        await wrapper.find('#typing-reset-btn').trigger('click')

        expect(wrapper.find('#typing-hud-caught').text()).toBe('0')
        expect(wrapper.find('#typing-hud-missed').text()).toBe('0')
        expect(wrapper.findAll('.typing-flyer')).toHaveLength(0)
        // The round is live again, not just cleared — the same fetched
        // pool keeps spawning without needing another show() call.
        await vi.advanceTimersByTimeAsync(700)
        expect(wrapper.findAll('.typing-flyer').length).toBeGreaterThan(0)
      } finally {
        wrapper.unmount()
      }
    })

    it('the speed control scales newly-spawned words, not ones already in flight', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HOLA] })

      function flyerX(): number {
        const transform = wrapper.find<HTMLElement>('.typing-flyer').element.style.transform
        // Not a bare /-?\d+\.?\d*/ scan: "translate3d(" itself contains a
        // digit, which a generic first-number-in-the-string match would
        // grab before ever reaching the real coordinate.
        return parseFloat(transform.match(/translate3d\((-?[\d.]+)px/)?.[1] ?? '0')
      }

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
        await vi.advanceTimersByTimeAsync(700)
        const normalStart = flyerX()
        await vi.advanceTimersByTimeAsync(300)
        const normalDelta = normalStart - flyerX() // positive: moving leftward

        // Selecting "Very fast" (1.8x) doesn't touch the flyer already in
        // flight — Reset (already covered by its own test) is what spawns
        // a fresh one under the new speed.
        const select = wrapper.find<HTMLSelectElement>('#typing-speed-select')
        select.element.value = '1.8'
        await select.trigger('change')
        await wrapper.find('#typing-reset-btn').trigger('click')
        await vi.advanceTimersByTimeAsync(700)
        const fastStart = flyerX()
        await vi.advanceTimersByTimeAsync(300)
        const fastDelta = fastStart - flyerX()

        // Exact-ratio math over a fixed number of fake-timer/rAF ticks is
        // brittle (frame count per advanceTimersByTimeAsync isn't an exact
        // guarantee) — asserting "clearly faster" proves the control has
        // an effect without pinning to precise frame timing.
        expect(fastDelta).toBeGreaterThan(normalDelta * 1.3)
      } finally {
        wrapper.unmount()
      }
    })

    it('does not steal focus from the speed select while it is open', async () => {
      vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-es', words: [HOLA] })

      const wrapper = mount(Typing, { attachTo: document.body })
      try {
        await wrapper.vm.show('test@example.com', 'pt-es', TOPIC)
        await vi.advanceTimersByTimeAsync(700)
        expect(document.activeElement).toBe(capture(wrapper))

        const select = wrapper.find<HTMLSelectElement>('#typing-speed-select').element
        select.focus() // what a click that opens the dropdown does first
        expect(document.activeElement).toBe(select)

        // Regression: any refocus queued off keyCapture's own blur (or, as
        // it used to be, a document-wide "click" listener) must not steal
        // focus back while the select is still the active element — doing
        // so is exactly what closed the dropdown on every click.
        await vi.advanceTimersByTimeAsync(50)
        expect(document.activeElement).toBe(select)

        select.blur() // the user is done with it (picked an option, or clicked away)
        expect(document.activeElement).toBe(capture(wrapper))
      } finally {
        wrapper.unmount()
      }
    })
  })
})
