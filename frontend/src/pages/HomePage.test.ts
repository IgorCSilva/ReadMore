import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import { requestHomeExpansion } from '../shared/homeExpansion'
import HomePage from './HomePage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getChapters: vi.fn(),
    getWords: vi.fn(),
  }
})

function testRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: HomePage },
      { path: '/part/:topicId/:partNumber', name: 'part-flow', component: { template: '<div>flow</div>' } },
      { path: '/read/:topicId', name: 'read-understand', component: { template: '<div>read</div>' } },
      { path: '/listen/:topicId', name: 'listen-identify', component: { template: '<div>listen</div>' } },
    ],
  })
}

const CHAPTERS = [
  {
    chapter_id: 'c1',
    number: 1,
    title: 'Basics',
    description: '',
    status: 'active',
    topics: [
      {
        topic_id: 't1', number: 1, title: 'Greetings', description: '',
        word_ids: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'],
        texts: [], sentences: [], phrases: [], status: 'active', exercises: [],
      },
      {
        topic_id: 't2', number: 2, title: 'Numbers', description: '',
        word_ids: [],
        texts: [], sentences: [], phrases: [], status: 'active', exercises: [],
      },
    ],
  },
]

const WORDS = Array.from({ length: 7 }, (_, i) => ({
  word_id: `w${i + 1}`,
  original: `word${i + 1}`,
  filename: '',
  sentence: '',
  cue: '',
  gender_id: '',
}))

async function mountReady() {
  vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: CHAPTERS })
  vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-en', words: WORDS })
  const router = testRouter()
  router.push('/')
  await router.isReady()
  const wrapper = mount(HomePage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('HomePage', () => {
  it('shows a bold "Olá, {email}" in a fixed top bar', async () => {
    const router = testRouter()
    router.push('/')
    await router.isReady()
    const wrapper = mount(HomePage, { attachTo: document.body, global: { plugins: [router] } })
    try {
      await nextTick()
      const topbar = wrapper.get('.home-topbar')
      const bold = topbar.get('strong')
      expect(bold.text()).toBe('Olá, test@example.com')
    } finally {
      wrapper.unmount()
    }
  })

  it('lists a card per topic, grouped by chapter, with number/title/not_started icon', async () => {
    const { wrapper } = await mountReady()
    try {
      expect(wrapper.find('.chapter-heading').text()).toBe('1. Basics')

      const cards = wrapper.findAll('.topic-card')
      expect(cards).toHaveLength(2)
      expect(cards.map((c) => c.get('.topic-card-number').text())).toEqual(['1.1', '1.2'])
      expect(cards.map((c) => c.get('.topic-card-title').text())).toEqual(['Greetings', 'Numbers'])
      expect(cards.every((c) => c.get('.topic-card-status').text() === '○')).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('expands a topic card on click into Part 1, Part 2, Read and Understand, Listen and identify', async () => {
    const { wrapper } = await mountReady()
    try {
      const cards = wrapper.findAll('.topic-card')
      expect(cards[0].find('.topic-parts').exists()).toBe(false)

      await cards[0].get('.topic-card-header').trigger('click')

      const labels = wrapper.findAll('.part-label').map((l) => l.text())
      expect(labels).toEqual(['Part 1', 'Part 2', 'Read and Understand', 'Listen and identify'])
    } finally {
      wrapper.unmount()
    }
  })

  it('collapses the topic card on a second click', async () => {
    const { wrapper } = await mountReady()
    try {
      const header = wrapper.findAll('.topic-card')[0].get('.topic-card-header')
      await header.trigger('click')
      expect(wrapper.find('.topic-parts').exists()).toBe(true)

      await header.trigger('click')
      expect(wrapper.find('.topic-parts').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('expanding a topic collapses the other and has no numbered parts for a topic with no words', async () => {
    const { wrapper } = await mountReady()
    try {
      const [firstHeader, secondHeader] = wrapper.findAll('.topic-card-header')
      await firstHeader.trigger('click')
      expect(wrapper.findAll('.topic-parts')).toHaveLength(1)

      await secondHeader.trigger('click')
      expect(wrapper.findAll('.topic-parts')).toHaveLength(1)
      const labels = wrapper.findAll('.part-label').map((l) => l.text())
      expect(labels).toEqual(['Read and Understand', 'Listen and identify'])
    } finally {
      wrapper.unmount()
    }
  })

  it('expanding a numbered Part shows its comma-separated words and a Start button', async () => {
    const { wrapper } = await mountReady()
    try {
      await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
      const partHeaders = wrapper.findAll('.part-header')

      await partHeaders[0].trigger('click')
      let body = wrapper.get('.part-body')
      expect(body.get('.part-words').text()).toBe('word1, word2, word3, word4, word5')
      expect(body.get('.part-start-btn').text()).toBe('Start')

      await partHeaders[1].trigger('click')
      body = wrapper.get('.part-body')
      expect(body.get('.part-words').text()).toBe('word6, word7')
    } finally {
      wrapper.unmount()
    }
  })

  it('expanding "Read and Understand" or "Listen and identify" shows only a Start button, no word list', async () => {
    const { wrapper } = await mountReady()
    try {
      await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
      const partHeaders = wrapper.findAll('.part-header')

      await partHeaders[2].trigger('click') // Read and Understand
      let body = wrapper.get('.part-body')
      expect(body.find('.part-words').exists()).toBe(false)
      expect(body.get('.part-start-btn').text()).toBe('Start')

      await partHeaders[3].trigger('click') // Listen and identify — collapses Read and Understand (accordion)
      body = wrapper.get('.part-body')
      expect(body.find('.part-words').exists()).toBe(false)
      expect(wrapper.findAll('.part-body')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('clicking Start on a numbered Part navigates to its dedicated teaching page', async () => {
    const { wrapper, router } = await mountReady()
    try {
      await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
      await wrapper.findAll('.part-header')[1].trigger('click') // Part 2
      await wrapper.get('.part-start-btn').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('part-flow')
      expect(router.currentRoute.value.params).toEqual({ topicId: 't1', partNumber: '2' })
    } finally {
      wrapper.unmount()
    }
  })

  it('clicking Start on "Read and Understand" navigates to its dedicated page', async () => {
    const { wrapper, router } = await mountReady()
    try {
      await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
      await wrapper.findAll('.part-header')[2].trigger('click') // Read and Understand
      await wrapper.get('.part-start-btn').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('read-understand')
      expect(router.currentRoute.value.params).toEqual({ topicId: 't1' })
    } finally {
      wrapper.unmount()
    }
  })

  it('clicking Start on "Listen and identify" navigates to its dedicated page', async () => {
    const { wrapper, router } = await mountReady()
    try {
      await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
      await wrapper.findAll('.part-header')[3].trigger('click') // Listen and identify
      await wrapper.get('.part-start-btn').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('listen-identify')
      expect(router.currentRoute.value.params).toEqual({ topicId: 't1' })
    } finally {
      wrapper.unmount()
    }
  })

  it('expands the requested topic/part on mount, from a pending PartFlowPage handoff', async () => {
    requestHomeExpansion({ topicId: 't1', partIndex: 1 })
    const { wrapper } = await mountReady()
    try {
      const labels = wrapper.findAll('.part-label').map((l) => l.text())
      expect(labels).toEqual(['Part 1', 'Part 2', 'Read and Understand', 'Listen and identify'])
      expect(wrapper.get('.part-body').get('.part-words').text()).toBe('word6, word7') // Part 2's words
    } finally {
      wrapper.unmount()
    }
  })

  it('only consumes the pending expansion once, not on a later plain visit', async () => {
    requestHomeExpansion({ topicId: 't1', partIndex: 1 })
    const first = await mountReady()
    first.wrapper.unmount()

    const { wrapper } = await mountReady()
    try {
      expect(wrapper.find('.topic-parts').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
