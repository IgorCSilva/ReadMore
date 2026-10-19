import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import type { Story } from '../shared/types'
import StoryReaderPage from './StoryReaderPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getStory: vi.fn(),
  }
})

const STORY: Story = {
  story_id: 'muddy_feet',
  title: 'Muddy Feet',
  level: 'B1',
  sentences: ['Line one.', 'Line two.', '', 'Line three.'],
  glossary: {},
}

async function mountPage() {
  vi.mocked(api.getStory).mockResolvedValue({ lang: 'pt-en', story: STORY })

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/stories', name: 'stories', component: { template: '<div>stories</div>' } },
      { path: '/stories/:level/:storyId', name: 'story-reader', component: StoryReaderPage },
    ],
  })
  router.push({ name: 'story-reader', params: { level: 'b1', storyId: 'muddy_feet' } })
  await router.isReady()

  const wrapper = mount(StoryReaderPage, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        StudyWordModal: { template: '<div class="study-stub">{{ sentence }}</div>', props: ['sentence'] },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('StoryReaderPage', () => {
  beforeEach(() => {
    // jsdom has no real media pipeline — mocking play()/pause() keeps the
    // component's own play-success path deterministic in tests without
    // tripping its TTS-failure fallback (which would otherwise cascade
    // through every remaining line via the "speechSynthesis unavailable in
    // jsdom -> treat as done -> auto-advance" branch).
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

  it('clicking a different line while playing jumps the highlight and keeps playing', async () => {
    const { wrapper } = await mountPage()
    try {
      await wrapper.get('.reader-control-btn').trigger('click')
      await wrapper.findAll('.reader-line')[1].trigger('click')

      const lines = wrapper.findAll('.reader-line')
      expect(lines[1].classes()).toContain('active')
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

  it('Study opens the modal for the currently highlighted line and pauses playback', async () => {
    const { wrapper } = await mountPage()
    try {
      await wrapper.findAll('.reader-line')[1].trigger('click')
      await wrapper.get('.reader-control-btn').trigger('click')

      await wrapper.get('.reader-study-btn').trigger('click')

      expect(wrapper.get('.study-stub').text()).toBe('Line two.')
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

  it('applies the current speed to newly created audio as playbackRate', async () => {
    const { wrapper } = await mountPage()
    try {
      await wrapper.get('.reader-speed-btn').trigger('click') // -> 1.25x

      const audioCtor = vi.spyOn(window, 'Audio')
      await wrapper.get('.reader-control-btn').trigger('click') // Play

      expect(audioCtor).toHaveBeenCalled()
      const createdAudio = audioCtor.mock.results[0]?.value as HTMLAudioElement
      expect(createdAudio.playbackRate).toBe(1.25)
    } finally {
      wrapper.unmount()
    }
  })

  it('the Exit button navigates back to /stories', async () => {
    const { wrapper, router } = await mountPage()
    try {
      await wrapper.get('.flow-exit-btn').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/stories')
    } finally {
      wrapper.unmount()
    }
  })
})
