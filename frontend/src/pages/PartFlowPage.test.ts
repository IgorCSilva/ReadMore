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

  it('advances through placeholder pages for Page 2/3, then Reading and Listen-and-write, via Next', async () => {
    const { wrapper } = await mountFlow()
    try {
      await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 2
      expect(wrapper.get('.placeholder-page').text()).toBe('Page 2 — coming soon')

      await wrapper.get('.flow-next-btn').trigger('click') // w1 Page 3
      expect(wrapper.get('.placeholder-page').text()).toBe('Page 3 — coming soon')

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
})
