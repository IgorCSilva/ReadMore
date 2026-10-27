import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../shared/api'
import { resetLangPreferenceForTests } from '../shared/languagePreference'
import PictureQuizPage from './PictureQuizPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getWords: vi.fn(),
  }
})

function word(id: string, original: string) {
  return {
    word_id: id, original, filename: 'picture.webp', sentence: '', cue: `cue for ${original}`,
    gender_id: 'not_apply', particle_type: 'not_apply',
  }
}

// Ten entries so the default optionCount (6) has enough distinct words to
// fill every round, in deliberate file order — same reasoning as
// Quiz.test.ts's CATALOG_WORDS.
const CATALOG_WORDS = Array.from({ length: 10 }, (_, i) => word(`cat-${i + 1}`, `catalog-${String(i + 1).padStart(2, '0')}`))

async function mountPage() {
  vi.mocked(api.getWords).mockResolvedValue({ lang: 'pt-es', words: CATALOG_WORDS })
  const wrapper = mount(PictureQuizPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('PictureQuizPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetLangPreferenceForTests()
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the whole catalog for the stored language pair and shows the picture quiz', async () => {
    localStorage.setItem('readmore_lang_pair', 'pt-es')
    const wrapper = await mountPage()
    try {
      expect(api.getWords).toHaveBeenCalledWith('pt-es')
      expect(wrapper.get<HTMLElement>('#topic-quiz-panel').element.style.display).toBe('flex')
      expect(wrapper.get('#quiz-counter').text()).toBe('1 / 10')
      expect(wrapper.findAll('.quiz-option')).toHaveLength(6)
      expect(wrapper.get<HTMLElement>('#quiz-jump').element.style.display).toBe('flex')
    } finally {
      wrapper.unmount()
    }
  })

  it('jumping to a typed position lands on that word in the catalog\'s own order', async () => {
    const wrapper = await mountPage()
    try {
      await wrapper.get<HTMLInputElement>('#quiz-jump-input').setValue(7)
      await wrapper.get('#quiz-jump-btn').trigger('click')

      expect(wrapper.get('#quiz-counter').text()).toBe('7 / 10')
      expect(wrapper.findAll('.quiz-option').map((o) => o.text())).toContain('catalog-07')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an error message if the catalog fails to load', async () => {
    vi.mocked(api.getWords).mockRejectedValue(new Error('network down'))
    const wrapper = mount(PictureQuizPage, { attachTo: document.body })
    await flushPromises()
    try {
      expect(wrapper.text()).toContain('network down')
    } finally {
      wrapper.unmount()
    }
  })
})
