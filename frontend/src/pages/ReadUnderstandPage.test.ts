import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import { consumeHomeExpansion } from '../shared/homeExpansion'
import { getPosition, savePosition } from '../shared/positionMemory'
import type { ChaptersResponse } from '../shared/types'
import ReadUnderstandPage from './ReadUnderstandPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getChapters: vi.fn(),
  }
})

// 10 words -> 2 numbered parts, so "Read and Understand"'s "next part" math
// (numberedPartsCount + 1) is exercised against a non-trivial count too.
const CHAPTERS = [
  {
    chapter_id: 'c1', number: 1, title: 'Basics', description: '', status: 'active',
    topics: [
      {
        topic_id: 't1', number: 1, title: 'Greetings', description: '',
        word_ids: Array.from({ length: 10 }, (_, i) => `w${i + 1}`),
        texts: [], sentences: [
          { sentence_number: 1, content: 'Said **oi** to a friend.' },
          { sentence_number: 2, content: 'Plain sentence.' },
        ],
        phrases: [], status: 'active', exercises: [],
      },
    ],
  },
]

async function mountPage({ settle = true } = {}) {
  vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: CHAPTERS })

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/read/:topicId', name: 'read-understand', component: ReadUnderstandPage },
    ],
  })
  router.push({ name: 'read-understand', params: { topicId: 't1' } })
  await router.isReady()

  const wrapper = mount(ReadUnderstandPage, { attachTo: document.body, global: { plugins: [router] } })
  if (settle) await flushPromises()
  return { wrapper, router }
}

describe('ReadUnderstandPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a loading spinner until the topic fetch resolves, then the sentences', async () => {
    // A manually-resolved promise, not mockResolvedValue — an
    // already-settled mock can resolve within the same microtask flush as
    // mount() itself, racing past the "still loading" state before this
    // test ever gets to observe it.
    let resolveChapters: (value: ChaptersResponse) => void = () => {}
    vi.mocked(api.getChapters).mockReturnValue(new Promise<ChaptersResponse>((resolve) => { resolveChapters = resolve }))

    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>home</div>' } },
        { path: '/read/:topicId', name: 'read-understand', component: ReadUnderstandPage },
      ],
    })
    router.push({ name: 'read-understand', params: { topicId: 't1' } })
    await router.isReady()
    const wrapper = mount(ReadUnderstandPage, { attachTo: document.body, global: { plugins: [router] } })

    try {
      expect(wrapper.find('.flow-spinner').exists()).toBe(true)
      expect(wrapper.find('.sentence-item').exists()).toBe(false)

      resolveChapters({ lang: 'pt-en', chapters: CHAPTERS })
      await flushPromises()

      expect(wrapper.find('.flow-spinner').exists()).toBe(false)
      expect(wrapper.find('.sentence-item').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('shows the topic\'s sentences, like the Sentences tab', async () => {
    const { wrapper } = await mountPage()
    try {
      const items = wrapper.findAll('.sentence-item')
      expect(items).toHaveLength(2)
      expect(wrapper.get('.sentence-item-content strong').text()).toBe('oi')
    } finally {
      wrapper.unmount()
    }
  })

  it('has a top bar with only an Exit button, no progress bar', async () => {
    const { wrapper } = await mountPage()
    try {
      expect(wrapper.find('.flow-exit-btn').exists()).toBe(true)
      expect(wrapper.find('.flow-progress').exists()).toBe(false)
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

  it('clicking Finish navigates home and requests "Listen and identify" expanded', async () => {
    const { wrapper, router } = await mountPage()
    try {
      await wrapper.get('.flow-next-btn').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/')
      // 10 words = 2 numbered parts (indices 0-1); "Read and Understand" is
      // index 2, so "Listen and identify" right after it is index 3.
      expect(consumeHomeExpansion()).toEqual({ topicId: 't1', partIndex: 3 })
    } finally {
      wrapper.unmount()
    }
  })

  describe('scroll position memory', () => {
    it('restores a previously saved scroll offset for this topic on mount', async () => {
      savePosition('read-understand:t1', 240)
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

      const { wrapper } = await mountPage()
      try {
        expect(scrollTo).toHaveBeenCalledWith(0, 240)
      } finally {
        wrapper.unmount()
      }
    })

    it('saves the current scroll offset when leaving, keyed per topic', async () => {
      savePosition('read-understand:t1', 0)
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      vi.spyOn(window, 'scrollY', 'get').mockReturnValue(180)

      const { wrapper } = await mountPage()
      wrapper.unmount()

      expect(getPosition('read-understand:t1')).toBe(180)
    })
  })
})
