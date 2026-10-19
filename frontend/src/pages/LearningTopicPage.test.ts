import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import type { LearningTopic } from '../shared/types'
import LearningTopicPage from './LearningTopicPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getLearningTopic: vi.fn(),
  }
})

const TOPIC: LearningTopic = {
  topic_id: 'NUT_1',
  theme: 'health',
  title: 'Macronutrientes',
  level: 'A1',
  sentences: ['Line one.', 'Line two.', '', 'Line three.'],
}

async function mountPage() {
  vi.mocked(api.getLearningTopic).mockResolvedValue({ lang: 'es', topic: TOPIC })

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/learning', name: 'learning', component: { template: '<div>learning</div>' } },
      { path: '/learning/:theme/:topicId', name: 'learning-topic', component: LearningTopicPage },
    ],
  })
  router.push({ name: 'learning-topic', params: { theme: 'health', topicId: 'NUT_1' } })
  await router.isReady()

  const wrapper = mount(LearningTopicPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('LearningTopicPage', () => {
  beforeEach(() => {
    // jsdom has no real media pipeline — mocking play()/pause() keeps the
    // component's own play-success path deterministic in tests without
    // tripping its TTS-failure fallback, same idiom as StoryReaderPage.test.ts.
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders each line as a clickable block, skipping blank lines, highlighting the first one', async () => {
    const { wrapper } = await mountPage()
    try {
      const lines = wrapper.findAll('.reader-line')
      expect(lines.map((l) => l.text())).toEqual(['Line one.', 'Line two.', 'Line three.'])
      expect(lines[0].classes()).toContain('active')
      expect(wrapper.find('.reader-blank').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('renders Markdown markers as formatting, not literal characters', async () => {
    vi.mocked(api.getLearningTopic).mockResolvedValue({
      lang: 'es',
      topic: {
        ...TOPIC,
        sentences: ['# Título', '## Subtítulo', '- Primer punto', 'Con **negrita** aquí.'],
      },
    })

    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/learning', name: 'learning', component: { template: '<div>learning</div>' } },
        { path: '/learning/:theme/:topicId', name: 'learning-topic', component: LearningTopicPage },
      ],
    })
    router.push({ name: 'learning-topic', params: { theme: 'health', topicId: 'NUT_1' } })
    await router.isReady()

    const wrapper = mount(LearningTopicPage, { attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()
    try {
      const lines = wrapper.findAll('.reader-line')
      expect(lines.map((l) => l.text())).toEqual([
        'Título',
        'Subtítulo',
        '• Primer punto',
        'Con negrita aquí.',
      ])
      expect(lines[0].classes()).toContain('reader-line--h1')
      expect(lines[1].classes()).toContain('reader-line--h2')
      expect(lines[2].classes()).toContain('reader-line--li')
      expect(lines[3].find('strong').exists()).toBe(true)
      expect(lines[3].find('strong').text()).toBe('negrita')
    } finally {
      wrapper.unmount()
    }
  })

  it('does not render a Study button', async () => {
    const { wrapper } = await mountPage()
    try {
      expect(wrapper.find('.reader-study-btn').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('clicking a line highlights it instead of the first one, without starting playback', async () => {
    const { wrapper } = await mountPage()
    try {
      await wrapper.findAll('.reader-line')[1].trigger('click')

      const lines = wrapper.findAll('.reader-line')
      expect(lines[1].classes()).toContain('active')
      expect(lines[0].classes()).not.toContain('active')
      expect(wrapper.get('.reader-control-btn').text()).toBe('▶')
    } finally {
      wrapper.unmount()
    }
  })

  it('Play switches to a pause icon', async () => {
    const { wrapper } = await mountPage()
    try {
      const playBtn = wrapper.get('.reader-control-btn')
      await playBtn.trigger('click')

      expect(wrapper.get('.reader-control-btn').text()).toBe('⏸')
    } finally {
      wrapper.unmount()
    }
  })

  it('Stop resets the highlight to the first line and stops playback', async () => {
    const { wrapper } = await mountPage()
    try {
      await wrapper.get('.reader-control-btn').trigger('click')
      await wrapper.findAll('.reader-line')[1].trigger('click')

      await wrapper.get('[aria-label="Stop"]').trigger('click')

      const lines = wrapper.findAll('.reader-line')
      expect(lines[0].classes()).toContain('active')
      expect(wrapper.get('.reader-control-btn').text()).toBe('▶')
    } finally {
      wrapper.unmount()
    }
  })

  it('renders the speed button to the left of Play, defaulting to 1x', async () => {
    const { wrapper } = await mountPage()
    try {
      const controls = wrapper.get('.reader-controls').element.children
      expect(controls[0].className).toContain('reader-speed-btn')
      expect(controls[1].className).toContain('reader-control-btn')
      expect(wrapper.get('.reader-speed-btn').text()).toBe('1x')
    } finally {
      wrapper.unmount()
    }
  })

  it('clicking the speed button cycles 1x -> 1.25x -> 0.5x -> 0.75x -> 1x', async () => {
    const { wrapper } = await mountPage()
    try {
      const speedBtn = wrapper.get('.reader-speed-btn')
      const expected = ['1.25x', '0.5x', '0.75x', '1x']
      for (const label of expected) {
        await speedBtn.trigger('click')
        expect(wrapper.get('.reader-speed-btn').text()).toBe(label)
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('the Exit button navigates back to /learning', async () => {
    const { wrapper, router } = await mountPage()
    try {
      await wrapper.get('.flow-exit-btn').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/learning')
    } finally {
      wrapper.unmount()
    }
  })
})
