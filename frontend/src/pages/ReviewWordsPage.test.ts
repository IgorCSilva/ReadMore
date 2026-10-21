import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import ReviewWordsPage from './ReviewWordsPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getWords: vi.fn(),
  }
})

async function mountPage() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/review-words', name: 'review-words', component: ReviewWordsPage }],
  })
  router.push('/review-words')
  await router.isReady()

  const wrapper = mount(ReviewWordsPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

function makeWords(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    word_id: `w${i + 1}`,
    original: `word${i + 1}`,
    filename: '',
    sentence: '',
    cue: '',
    gender_id: 'not_apply',
    particle_type: '',
  }))
}

// Mirrors ReviewWordsPage.vue's own DD-MM-YYYY formatting, to compute the id
// of the day section the page should auto-scroll to.
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getFullYear()}`
}

describe('ReviewWordsPage', () => {
  beforeEach(() => {
    vi.mocked(api.getWords).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('groups words into chunks of the default quantity, one chunk per day', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-es', words: makeWords(45) })

    const { wrapper } = await mountPage()
    try {
      const days = wrapper.findAll('.review-words-day')
      // 11 dates (7 days ago through 3 days after) at 20 words/day would
      // need 220 words to fill every slot — only the first 3 days (60) have
      // any of the 45 available, so only 3 day sections render.
      expect(days).toHaveLength(3)
      expect(days[0].findAll('.review-words-word')).toHaveLength(20)
      expect(days[1].findAll('.review-words-word')).toHaveLength(20)
      expect(days[2].findAll('.review-words-word')).toHaveLength(5)
    } finally {
      wrapper.unmount()
    }
  })

  it('re-chunks the already-loaded words when the quantity selection changes', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-es', words: makeWords(45) })

    const { wrapper } = await mountPage()
    try {
      expect(api.getWords).toHaveBeenCalledTimes(1)

      await wrapper.get('.review-words-select').setValue('25')
      await flushPromises()

      // Still one fetch — changing quantity only re-slices client-side.
      expect(api.getWords).toHaveBeenCalledTimes(1)
      const days = wrapper.findAll('.review-words-day')
      expect(days).toHaveLength(2)
      expect(days[0].findAll('.review-words-word')).toHaveLength(25)
      expect(days[1].findAll('.review-words-word')).toHaveLength(20)
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an empty message when there are no words yet', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-es', words: [] })

    const { wrapper } = await mountPage()
    try {
      expect(wrapper.get('.review-words-empty').text()).toContain('No words to review yet')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an error message if the fetch fails', async () => {
    vi.mocked(api.getWords).mockRejectedValue(new Error('network down'))

    const { wrapper } = await mountPage()
    try {
      expect(wrapper.get('.review-words-error').text()).toContain('network down')
    } finally {
      wrapper.unmount()
    }
  })

  it("smooth-scrolls today's date section into view once the words load", async () => {
    // 7 days before today is index 0, so today (offset 0) is the 8th day
    // section — needs at least 8 * 20 words for that slice to be non-empty.
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-es', words: makeWords(200) })
    const scrollIntoView = vi.fn()
    // jsdom has no layout engine and doesn't implement scrollIntoView at all.
    Element.prototype.scrollIntoView = scrollIntoView

    const { wrapper } = await mountPage()
    try {
      const todayId = `review-day-${formatDate(new Date())}`
      expect(document.getElementById(todayId)).not.toBeNull()
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    } finally {
      wrapper.unmount()
      // @ts-expect-error - removing the jsdom-only stub added above
      delete Element.prototype.scrollIntoView
    }
  })

  it('clicking a word reveals audio and cue actions for it', async () => {
    vi.mocked(api.getWords).mockResolvedValue({
      lang: 'pt-es',
      words: [
        { word_id: 'w1', original: 'hola', filename: '', sentence: '', cue: 'greeting', gender_id: 'not_apply', particle_type: '' },
      ],
    })

    const { wrapper } = await mountPage()
    try {
      await wrapper.get('.review-words-word').trigger('click')
      await flushPromises()

      const balloon = document.querySelector('.target-word-balloon')
      expect(balloon).not.toBeNull()
      expect(balloon?.querySelector('[aria-label="Play audio"]')).not.toBeNull()

      const cueButton = balloon?.querySelector('[aria-label="Show cue"]')
      expect(cueButton).not.toBeNull()
      ;(cueButton as HTMLElement).click()
      await flushPromises()

      expect(document.body.textContent).toContain('greeting')
    } finally {
      wrapper.unmount()
    }
  })
})
