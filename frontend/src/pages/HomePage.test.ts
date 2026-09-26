import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import { getCurrentUser } from '../shared/currentUser'
import { requestHomeExpansion } from '../shared/homeExpansion'
import { resetLangPreferenceForTests } from '../shared/languagePreference'
import type { ChaptersResponse } from '../shared/types'
import HomePage from './HomePage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getChapters: vi.fn(),
    getWords: vi.fn(),
    getReinforcementWords: vi.fn(),
    getUser: vi.fn(),
  }
})

function testRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'presentation', component: { template: '<div>presentation</div>' } },
      { path: '/home', name: 'home', component: HomePage },
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
  particle_type: '',
}))

// Reinforcement word_ids come from earlier topics, not this one — these
// exist in the words catalog (so wordsText can resolve their display text)
// but are never part of any topic's own word_ids. 7 ids over a topic with 2
// numbered Parts (5+2 words) leaves 3 unclaimed (rw5-rw7) for the dedicated
// Review part: reinforcementWordIdsForPart gives Part 1 rw1/rw2, Part 2
// rw3/rw4, and reviewWordIds gives Review the rest.
const REINFORCEMENT_WORDS = Array.from({ length: 7 }, (_, i) => ({
  word_id: `rw${i + 1}`,
  original: `reinforce${i + 1}`,
  filename: '',
  sentence: '',
  cue: '',
  gender_id: '',
  particle_type: '',
}))
const REINFORCEMENT_WORD_IDS = REINFORCEMENT_WORDS.map((w) => w.word_id)

async function mountReady() {
  vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: CHAPTERS })
  vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-en', words: [...WORDS, ...REINFORCEMENT_WORDS] })
  vi.mocked(api.getReinforcementWords).mockResolvedValue([])
  const router = testRouter()
  router.push('/home')
  await router.isReady()
  const wrapper = mount(HomePage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('HomePage', () => {
  beforeEach(() => {
    // languagePreference's `cached`, and everything HomePage.vue's own
    // stale-while-revalidate loaders (loadChapters/loadWords/resolveLang)
    // write into localStorage's readCache, are all singletons that outlive
    // a single test within this file — reset both, or an earlier test's
    // setLangPair() call, or its cached chapters/words/user response, would
    // leak into a later test and get served instead of that test's own
    // freshly configured mock.
    localStorage.clear()
    resetLangPreferenceForTests()
    vi.mocked(api.getUser).mockResolvedValue({ exists: true, language_pairs: ['pt-en'] })
  })

  it('shows a bold "Olá, {email}" in a fixed top bar', async () => {
    const router = testRouter()
    router.push('/home')
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

  it('the Logout button, aligned right in the top bar, clears the signed-in user and returns to the Presentation page', async () => {
    const { wrapper, router } = await mountReady()
    try {
      expect(getCurrentUser().email).toBe('test@example.com')

      await wrapper.get('.home-logout-btn').trigger('click')
      await flushPromises()

      expect(getCurrentUser().email).toBeNull()
      expect(localStorage.getItem('readmore_user_email')).toBeNull()
      expect(router.currentRoute.value.path).toBe('/')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows a loading spinner until the chapters/words fetch resolves, then the topic cards', async () => {
    // A manually-resolved promise, not mockResolvedValue — an
    // already-settled mock can resolve within the same microtask flush as
    // mount() itself, racing past the "still loading" state before this
    // test ever gets to observe it.
    let resolveChapters: (value: ChaptersResponse) => void = () => {}
    vi.mocked(api.getChapters).mockReturnValue(new Promise<ChaptersResponse>((resolve) => { resolveChapters = resolve }))
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-en', words: WORDS })

    const router = testRouter()
    router.push('/home')
    await router.isReady()
    const wrapper = mount(HomePage, { attachTo: document.body, global: { plugins: [router] } })

    try {
      expect(wrapper.find('.home-spinner').exists()).toBe(true)
      expect(wrapper.find('.topic-card').exists()).toBe(false)

      resolveChapters({ lang: 'pt-en', chapters: CHAPTERS })
      await flushPromises()

      expect(wrapper.find('.home-spinner').exists()).toBe(false)
      expect(wrapper.find('.topic-card').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('skips the loading spinner on a later mount, rendering cached chapters/words instantly instead of waiting on a fresh request', async () => {
    const { wrapper: first } = await mountReady()
    first.unmount()

    // Never-resolving promises for the second mount's own requests — if the
    // component were still blocking on them (i.e. caching wasn't working),
    // the assertions below would hang/fail instead of passing immediately.
    vi.mocked(api.getChapters).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getWords).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getUser).mockReturnValue(new Promise(() => {}))

    const router = testRouter()
    router.push('/home')
    await router.isReady()
    const wrapper = mount(HomePage, { attachTo: document.body, global: { plugins: [router] } })
    try {
      await flushPromises()

      expect(wrapper.find('.home-spinner').exists()).toBe(false)
      expect(wrapper.findAll('.topic-card')).toHaveLength(2)
    } finally {
      wrapper.unmount()
    }
  })

  it("falls back to one of the user's enabled language pairs when the stored/default one isn't enabled for them", async () => {
    vi.mocked(api.getUser).mockResolvedValue({ exists: true, language_pairs: ['pt-es'] })
    vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-es', chapters: CHAPTERS })
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-es', words: [...WORDS, ...REINFORCEMENT_WORDS] })
    vi.mocked(api.getReinforcementWords).mockResolvedValue([])

    const router = testRouter()
    router.push('/home')
    await router.isReady()
    const wrapper = mount(HomePage, { attachTo: document.body, global: { plugins: [router] } })
    try {
      await flushPromises()

      expect(api.getChapters).toHaveBeenCalledWith('test@example.com', 'pt-es')
      expect(localStorage.getItem('readmore_lang_pair')).toBe('pt-es')
      expect(wrapper.findAll('.topic-card')).toHaveLength(2)
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an empty-state message instead of a blank page when the user has no chapters enabled', async () => {
    vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: [] })
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-en', words: [] })

    const router = testRouter()
    router.push('/home')
    await router.isReady()
    const wrapper = mount(HomePage, { attachTo: document.body, global: { plugins: [router] } })
    try {
      await flushPromises()

      expect(wrapper.get('.home-empty').text()).toContain('Nothing enabled')
      expect(wrapper.find('.topic-card').exists()).toBe(false)
      expect(wrapper.find('.home-spinner').exists()).toBe(false)
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

  it('expands a topic card on click into Part 1, Part 2, Read and Understand, Listen and Identify', async () => {
    const { wrapper } = await mountReady()
    try {
      const cards = wrapper.findAll('.topic-card')
      expect(cards[0].find('.topic-parts').exists()).toBe(false)

      await cards[0].get('.topic-card-header').trigger('click')

      const labels = wrapper.findAll('.part-label').map((l) => l.text())
      expect(labels).toEqual(['Part 1', 'Part 2', 'Read and Understand', 'Listen and Identify'])
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
      expect(labels).toEqual(['Read and Understand', 'Listen and Identify'])
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

  describe('reinforcement words', () => {
    it('shows a numbered Part\'s new words in bold and its 2 reinforcement words in italic', async () => {
      const { wrapper } = await mountReady()
      try {
        vi.mocked(api.getReinforcementWords).mockResolvedValue(REINFORCEMENT_WORD_IDS)
        await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
        await flushPromises()

        await wrapper.findAll('.part-header')[0].trigger('click') // Part 1
        const body = wrapper.get('.part-body')
        expect(body.get('.part-word-new').text()).toBe('word1, word2, word3, word4, word5')
        expect(body.get('.part-word-reinforce').text()).toBe('reinforce1, reinforce2')
      } finally {
        wrapper.unmount()
      }
    })

    it('inserts a "Review" Part, after the numbered parts, for reinforcement words left unclaimed by them', async () => {
      const { wrapper } = await mountReady()
      try {
        vi.mocked(api.getReinforcementWords).mockResolvedValue(REINFORCEMENT_WORD_IDS)
        await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
        await flushPromises()

        const labels = wrapper.findAll('.part-label').map((l) => l.text())
        expect(labels).toEqual(['Part 1', 'Part 2', 'Review', 'Read and Understand', 'Listen and Identify'])

        await wrapper.findAll('.part-header')[2].trigger('click') // Review
        const body = wrapper.get('.part-body')
        expect(body.find('.part-word-new').exists()).toBe(false)
        expect(body.get('.part-word-reinforce').text()).toBe('reinforce5, reinforce6, reinforce7')
      } finally {
        wrapper.unmount()
      }
    })

    it('omits the "Review" Part when every reinforcement word was already claimed by a numbered Part', async () => {
      const { wrapper } = await mountReady()
      try {
        vi.mocked(api.getReinforcementWords).mockResolvedValue(REINFORCEMENT_WORD_IDS.slice(0, 4)) // exactly 2 per part, none left
        await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
        await flushPromises()

        const labels = wrapper.findAll('.part-label').map((l) => l.text())
        expect(labels).toEqual(['Part 1', 'Part 2', 'Read and Understand', 'Listen and Identify'])
      } finally {
        wrapper.unmount()
      }
    })

    it('clicking Start on "Review" navigates to the teaching page with a "review" partNumber', async () => {
      const { wrapper, router } = await mountReady()
      try {
        vi.mocked(api.getReinforcementWords).mockResolvedValue(REINFORCEMENT_WORD_IDS)
        await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
        await flushPromises()

        await wrapper.findAll('.part-header')[2].trigger('click') // Review
        await wrapper.get('.part-start-btn').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.name).toBe('part-flow')
        expect(router.currentRoute.value.params).toEqual({ topicId: 't1', partNumber: 'review' })
      } finally {
        wrapper.unmount()
      }
    })

    it('fetches reinforcement words once per topic, reusing the cached value on re-expansion', async () => {
      const { wrapper } = await mountReady()
      try {
        vi.mocked(api.getReinforcementWords).mockResolvedValue(REINFORCEMENT_WORD_IDS)
        // Nothing else in this test asserts on call count, but mocks aren't
        // cleared between tests in this file (no global clearMocks/afterEach
        // here) — earlier tests' calls to this same mock would otherwise be
        // counted too, so clear its history right before the sequence this
        // assertion actually cares about.
        vi.mocked(api.getReinforcementWords).mockClear()
        const header = wrapper.findAll('.topic-card')[0].get('.topic-card-header')

        await header.trigger('click') // expand
        await flushPromises()
        await header.trigger('click') // collapse
        await header.trigger('click') // expand again
        await flushPromises()

        expect(api.getReinforcementWords).toHaveBeenCalledOnce()
      } finally {
        wrapper.unmount()
      }
    })
  })

  it('expanding "Read and Understand" or "Listen and Identify" shows only a Start button, no word list', async () => {
    const { wrapper } = await mountReady()
    try {
      await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
      const partHeaders = wrapper.findAll('.part-header')

      await partHeaders[2].trigger('click') // Read and Understand
      let body = wrapper.get('.part-body')
      expect(body.find('.part-words').exists()).toBe(false)
      expect(body.get('.part-start-btn').text()).toBe('Start')

      await partHeaders[3].trigger('click') // Listen and Identify — collapses Read and Understand (accordion)
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

  it('clicking Start on "Listen and Identify" navigates to its dedicated page', async () => {
    const { wrapper, router } = await mountReady()
    try {
      await wrapper.findAll('.topic-card')[0].get('.topic-card-header').trigger('click')
      await wrapper.findAll('.part-header')[3].trigger('click') // Listen and Identify
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
      expect(labels).toEqual(['Part 1', 'Part 2', 'Read and Understand', 'Listen and Identify'])
      expect(wrapper.get('.part-body').get('.part-words').text()).toBe('word6, word7') // Part 2's words
    } finally {
      wrapper.unmount()
    }
  })

  it('loads reinforcement words for a topic pre-expanded via a pending PartFlowPage handoff (not just on a manual click)', async () => {
    requestHomeExpansion({ topicId: 't1', partIndex: 1 })
    vi.mocked(api.getChapters).mockResolvedValue({ lang: 'pt-en', chapters: CHAPTERS })
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-en', words: [...WORDS, ...REINFORCEMENT_WORDS] })
    vi.mocked(api.getReinforcementWords).mockResolvedValue(REINFORCEMENT_WORD_IDS)

    const router = testRouter()
    router.push('/home')
    await router.isReady()
    const wrapper = mount(HomePage, { attachTo: document.body, global: { plugins: [router] } })
    try {
      await flushPromises()

      const body = wrapper.get('.part-body') // Part 2, pre-expanded
      expect(body.get('.part-word-new').text()).toBe('word6, word7')
      expect(body.get('.part-word-reinforce').text()).toBe('reinforce3, reinforce4')
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
