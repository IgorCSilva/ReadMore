import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import LearningPage from './LearningPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getLearningTopics: vi.fn(),
  }
})

async function mountPage() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/learning', name: 'learning', component: LearningPage },
      { path: '/learning/:theme/:topicId', name: 'learning-topic', component: { template: '<div>reader</div>' } },
    ],
  })
  router.push('/learning')
  await router.isReady()

  const wrapper = mount(LearningPage, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('LearningPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('groups topics by theme', async () => {
    vi.mocked(api.getLearningTopics).mockResolvedValue({
      lang: 'es',
      topics: [
        { topic_id: 'NUT_1', theme: 'health', title: 'Macronutrientes', level: 'A1' },
        { topic_id: 'EXE_1', theme: 'health', title: 'Ejercicio', level: 'A1' },
      ],
    })

    const { wrapper } = await mountPage()
    try {
      expect(wrapper.findAll('.theme-heading').map((h) => h.text())).toEqual(['Health'])
      expect(wrapper.findAll('.topic-card').map((c) => c.text())).toEqual([
        '(A1) Macronutrientes',
        '(A1) Ejercicio',
      ])
    } finally {
      wrapper.unmount()
    }
  })

  it('links a topic card to its reader page, by theme and topic id', async () => {
    vi.mocked(api.getLearningTopics).mockResolvedValue({
      lang: 'es',
      topics: [{ topic_id: 'NUT_1', theme: 'health', title: 'Macronutrientes', level: 'A1' }],
    })

    const { wrapper, router } = await mountPage()
    try {
      const card = wrapper.get('.topic-card')
      await card.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/learning/health/NUT_1')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an empty message when there is no content yet', async () => {
    vi.mocked(api.getLearningTopics).mockResolvedValue({ lang: 'es', topics: [] })

    const { wrapper } = await mountPage()
    try {
      expect(wrapper.get('.learning-empty').text()).toBe('No content yet.')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an error message if the fetch fails', async () => {
    vi.mocked(api.getLearningTopics).mockRejectedValue(new Error('network down'))

    const { wrapper } = await mountPage()
    try {
      expect(wrapper.get('.learning-error').text()).toContain('network down')
    } finally {
      wrapper.unmount()
    }
  })
})
