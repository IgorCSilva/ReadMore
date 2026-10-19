import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import StoriesPage from './StoriesPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getStories: vi.fn(),
  }
})

async function mountPage() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/stories', name: 'stories', component: StoriesPage },
      { path: '/stories/:level/:storyId', name: 'story-reader', component: { template: '<div>reader</div>' } },
    ],
  })
  router.push('/stories')
  await router.isReady()

  const wrapper = mount(StoriesPage, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('StoriesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows all six CEFR level sections even when only some have stories', async () => {
    vi.mocked(api.getStories).mockResolvedValue({
      lang: 'pt-en',
      stories: [{ story_id: 'muddy_feet', title: 'Muddy Feet', level: 'B1' }],
    })

    const { wrapper } = await mountPage()
    try {
      const headings = wrapper.findAll('.level-heading').map((h) => h.text())
      expect(headings).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

      const emptyLevels = wrapper.findAll('.level-empty')
      expect(emptyLevels).toHaveLength(5)
    } finally {
      wrapper.unmount()
    }
  })

  it('links a story card to its reader page, by level and story id', async () => {
    vi.mocked(api.getStories).mockResolvedValue({
      lang: 'pt-en',
      stories: [{ story_id: 'muddy_feet', title: 'Muddy Feet', level: 'B1' }],
    })

    const { wrapper, router } = await mountPage()
    try {
      const card = wrapper.get('.story-card')
      expect(card.text()).toBe('Muddy Feet')

      await card.trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/stories/b1/muddy_feet')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an error message if the fetch fails', async () => {
    vi.mocked(api.getStories).mockRejectedValue(new Error('network down'))

    const { wrapper } = await mountPage()
    try {
      expect(wrapper.get('.stories-error').text()).toContain('network down')
    } finally {
      wrapper.unmount()
    }
  })
})
