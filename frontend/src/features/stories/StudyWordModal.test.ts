import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlossaryEntry } from '../../shared/types'
import StudyWordModal from './StudyWordModal.vue'

const GLOSSARY: Record<string, GlossaryEntry> = {
  rain: {
    meaning: 'Chuva.',
    examples: ['It started to rain.'],
    synonyms: ['shower'],
    antonyms: ['drought'],
  },
  fell: {
    meaning: 'Caiu.',
    examples: ['The rain fell.'],
    synonyms: ['dropped'],
    antonyms: ['rose'],
  },
}

function mountModal(sentence = 'Rain fell.') {
  return mount(StudyWordModal, {
    attachTo: document.body,
    props: { sentence, glossary: GLOSSARY, targetLangCode: 'en' },
  })
}

describe('StudyWordModal', () => {
  beforeEach(() => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders every word of the sentence as a button, selecting the first one by default', () => {
    const wrapper = mountModal()
    try {
      const wordButtons = wrapper.findAll('.study-word-btn')
      expect(wordButtons.map((b) => b.text())).toEqual(['Rain', 'fell'])
      expect(wordButtons[0].classes()).toContain('active')
      expect(wrapper.get('.study-word').text()).toBe('Rain')
      expect(wrapper.get('.study-meaning').text()).toBe('Chuva.')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows examples, synonyms and antonyms for the selected word', () => {
    const wrapper = mountModal()
    try {
      expect(wrapper.get('.study-list-item').text()).toContain('It started to rain.')
      const chips = wrapper.findAll('.study-chip').map((c) => c.text())
      expect(chips.some((c) => c.includes('shower'))).toBe(true)
      expect(chips.some((c) => c.includes('drought'))).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('shows a fallback message for a word with no glossary entry', async () => {
    const wrapper = mountModal('Rain pours.')
    try {
      await wrapper.findAll('.study-word-btn')[1].trigger('click')
      expect(wrapper.find('.study-hint').exists()).toBe(true)
      expect(wrapper.find('.study-meaning').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('switches the selected word and its info when a different word button is clicked', async () => {
    const wrapper = mountModal('Rain fell.')
    try {
      await wrapper.findAll('.study-word-btn')[1].trigger('click')
      expect(wrapper.findAll('.study-word-btn')[1].classes()).toContain('active')
      expect(wrapper.get('.study-word').text()).toBe('fell')
    } finally {
      wrapper.unmount()
    }
  })

  it('plays the selected word through the backend TTS proxy when its listen button is clicked', async () => {
    const wrapper = mountModal()
    try {
      const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play')
      await wrapper.find('.study-word-row button').trigger('click')
      expect(playSpy).toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mountModal()
    try {
      await wrapper.get('.study-close').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('emits close when clicking the overlay outside the card', async () => {
    const wrapper = mountModal()
    try {
      await wrapper.get('.study-overlay').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('emits close on Escape', async () => {
    const wrapper = mountModal()
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('close')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })
})
