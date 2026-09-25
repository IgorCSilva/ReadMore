import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import { consumeHomeExpansion } from '../shared/homeExpansion'
import { getPosition, savePosition } from '../shared/positionMemory'
import { resetUserWordsStoreForTests } from '../shared/userWords'
import ListenIdentifyPage from './ListenIdentifyPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getChapters: vi.fn(),
    getUserWords: vi.fn(),
  }
})

function word(id: string, original: string) {
  return {
    word_id: id, original, filename: '', sentence: '', cue: '', gender_id: 'not_apply',
    confident: false, shown_count: 0, show: true,
  }
}

const WORDS = [word('w1', 'padre'), word('w2', 'madre')]

// t1 has two single/two-word phrases (2 rounds); t2/t3 don't need real
// phrases content — they only ever stand in as a "next topic" target.
const T1 = {
  topic_id: 't1', number: 1, title: 'Family', description: '',
  word_ids: ['w1', 'w2'],
  texts: [], sentences: [],
  phrases: [
    { id: 'ph1', sentence: 'Meu padre e minha madre.', word_ids: ['w1', 'w2'] },
    { id: 'ph2', sentence: 'Meu padre chegou.', word_ids: ['w1'] },
  ],
  status: 'active', exercises: [],
}
const T2 = {
  topic_id: 't2', number: 2, title: 'Numbers', description: '',
  word_ids: [], texts: [], sentences: [], phrases: [], status: 'active', exercises: [],
}
const T3 = {
  topic_id: 't3', number: 1, title: 'Colors', description: '',
  word_ids: [], texts: [], sentences: [], phrases: [], status: 'active', exercises: [],
}

const CHAPTERS = [
  { chapter_id: 'c1', number: 1, title: 'Basics', description: '', status: 'active', topics: [T1, T2] },
  { chapter_id: 'c2', number: 2, title: 'More', description: '', status: 'active', topics: [T3] },
]

// Same trick as Phrases.test.ts: pinned just under 1, Fisher-Yates always
// swaps an index with itself, so both the rounds' and options' pre-shuffle
// (insertion) order survives — t1's rounds stay [ph1, ph2].
const NO_SHUFFLE_RANDOM = 0.999999

async function mountPage(topicId = 't1', { settle = true } = {}) {
  vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: CHAPTERS })
  vi.mocked(api.getUserWords).mockResolvedValue({ lang: 'pt-en', words: WORDS })

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/listen/:topicId', name: 'listen-identify', component: ListenIdentifyPage },
    ],
  })
  router.push({ name: 'listen-identify', params: { topicId } })
  await router.isReady()

  const wrapper = mount(ListenIdentifyPage, { attachTo: document.body, global: { plugins: [router] } })
  if (settle) await flushPromises()
  return { wrapper, router }
}

function findOptionByText(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAll<HTMLButtonElement>('.phrase-option')
    .find((o) => o.find('.phrase-option-label').text() === text)
  if (!found) throw new Error(`no phrase option with text "${text}"`)
  return found
}

describe('ListenIdentifyPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetUserWordsStoreForTests()
    vi.spyOn(Math, 'random').mockReturnValue(NO_SHUFFLE_RANDOM)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows the Phrases drill running, like the Phrases tab', async () => {
    const { wrapper } = await mountPage()
    try {
      expect(wrapper.get<HTMLElement>('#topic-phrases-panel').element.style.display).toBe('flex')
      expect(wrapper.get('#phrases-counter').text()).toBe('1 / 2')
      expect(wrapper.findAll('.phrase-option').length).toBeGreaterThan(0)
    } finally {
      wrapper.unmount()
    }
  })

  it('has a top bar with a progress bar that fills as rounds advance', async () => {
    vi.useFakeTimers()
    const { wrapper } = await mountPage()
    try {
      expect(wrapper.get('.flow-progress-fill').attributes('style')).toContain('width: 50%')

      await findOptionByText(wrapper, 'padre').trigger('click')
      await findOptionByText(wrapper, 'madre').trigger('click')
      await vi.advanceTimersByTimeAsync(1000)

      expect(wrapper.get('#phrases-counter').text()).toBe('2 / 2')
      expect(wrapper.get('.flow-progress-fill').attributes('style')).toContain('width: 100%')
    } finally {
      wrapper.unmount()
    }
  })

  it('the Exit button navigates back to Home', async () => {
    const { wrapper, router } = await mountPage()
    try {
      await wrapper.get('.flow-exit-btn').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/')
    } finally {
      wrapper.unmount()
    }
  })

  describe('Finishing (bottom bar button)', () => {
    it('clicking Finish navigates home and requests the next topic in the same chapter expanded', async () => {
      const { wrapper, router } = await mountPage('t1')
      try {
        await wrapper.get('.flow-next-btn').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/')
        expect(consumeHomeExpansion()).toEqual({ topicId: 't2', partIndex: 0 })
      } finally {
        wrapper.unmount()
      }
    })

    it('requests the next chapter\'s first topic when this was the last topic of its chapter', async () => {
      const { wrapper, router } = await mountPage('t2')
      try {
        await wrapper.get('.flow-next-btn').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/')
        expect(consumeHomeExpansion()).toEqual({ topicId: 't3', partIndex: 0 })
      } finally {
        wrapper.unmount()
      }
    })

    it('requests no expansion when this was the very last topic overall', async () => {
      const { wrapper, router } = await mountPage('t3')
      try {
        await wrapper.get('.flow-next-btn').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/')
        expect(consumeHomeExpansion()).toBeNull()
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('round position memory', () => {
    it('resumes at the previously reached round instead of always restarting at round 1', async () => {
      savePosition('listen-identify:t1', 1)
      const { wrapper } = await mountPage('t1')
      try {
        expect(wrapper.get('#phrases-counter').text()).toBe('2 / 2')
      } finally {
        wrapper.unmount()
      }
    })

    it('saves the round position as rounds advance, keyed per topic', async () => {
      vi.useFakeTimers()
      savePosition('listen-identify:t1', 0)
      const { wrapper } = await mountPage('t1')

      await findOptionByText(wrapper, 'padre').trigger('click')
      await findOptionByText(wrapper, 'madre').trigger('click')
      await vi.advanceTimersByTimeAsync(1000)

      expect(getPosition('listen-identify:t1')).toBe(1)
      wrapper.unmount()
    })
  })
})
