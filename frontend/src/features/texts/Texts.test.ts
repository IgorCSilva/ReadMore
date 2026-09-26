import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import Texts from './Texts.vue'

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return {
    ...actual,
    getWords: vi.fn(),
  }
})

const TOPIC = {
  texts: [
    { text_id: 't1', number: 1, title: 'Greetings', body: 'Hello, **friend**!\nSee you **soon**.' },
    { text_id: 't2', number: 2, title: 'Farewells', body: 'Goodbye.' },
  ],
}

// The component rebuilds the whole list on every render (innerHTML = "" +
// re-append), so any element reference captured before a click is stale
// once that click re-renders — every assertion below re-queries fresh
// rather than holding on to a node across a click. attachTo: document.body
// plus a real #texts-list id also means a wrapper left mounted after a
// failed assertion would leak into the next test's document.getElementById
// lookup (it returns the first matching id in the document, which could be
// a stale, unmounted tree) — try/finally guarantees unmount runs either way.

describe('Texts', () => {
  it('lists every text collapsed, showing only number and title', () => {
    const wrapper = mount(Texts, { attachTo: document.body })
    try {
      wrapper.vm.show(TOPIC)

      const items = wrapper.findAll('.text-accordion-item')
      expect(items).toHaveLength(2)
      expect(items[0].classes()).not.toContain('expanded')
      expect(items[1].classes()).not.toContain('expanded')

      expect(wrapper.findAll('.text-accordion-number').map((n) => n.text())).toEqual(['1', '2'])
      expect(wrapper.findAll('.text-accordion-title').map((n) => n.text())).toEqual(['Greetings', 'Farewells'])
      expect(wrapper.findAll('.text-accordion-body')).toHaveLength(0)
    } finally {
      wrapper.unmount()
    }
  })

  it('expands a text on click, rendering **bold** spans as <strong>', async () => {
    const wrapper = mount(Texts, { attachTo: document.body })
    try {
      wrapper.vm.show(TOPIC)

      await wrapper.findAll('.text-accordion-header')[0].trigger('click')

      const item = wrapper.findAll('.text-accordion-item')[0]
      expect(item.classes()).toContain('expanded')
      expect(item.find('.text-accordion-header').attributes('aria-expanded')).toBe('true')

      const strongs = wrapper.findAll('.text-accordion-body strong')
      expect(strongs).toHaveLength(2)
      expect(strongs[0].text()).toBe('friend')
      expect(strongs[1].text()).toBe('soon')
    } finally {
      wrapper.unmount()
    }
  })

  it('collapses the previously expanded text when a different one is opened', async () => {
    const wrapper = mount(Texts, { attachTo: document.body })
    try {
      wrapper.vm.show(TOPIC)

      await wrapper.findAll('.text-accordion-header')[0].trigger('click')
      expect(wrapper.findAll('.text-accordion-item')[0].classes()).toContain('expanded')

      await wrapper.findAll('.text-accordion-header')[1].trigger('click')

      const items = wrapper.findAll('.text-accordion-item')
      expect(items[0].classes()).not.toContain('expanded')
      expect(items[1].classes()).toContain('expanded')
      expect(wrapper.findAll('.text-accordion-body')).toHaveLength(1)
      expect(wrapper.find('.text-accordion-body').text()).toBe('Goodbye.')
    } finally {
      wrapper.unmount()
    }
  })

  it('collapses an expanded text when clicked again', async () => {
    const wrapper = mount(Texts, { attachTo: document.body })
    try {
      wrapper.vm.show(TOPIC)

      await wrapper.findAll('.text-accordion-header')[0].trigger('click')
      expect(wrapper.findAll('.text-accordion-item')[0].classes()).toContain('expanded')

      await wrapper.findAll('.text-accordion-header')[0].trigger('click')
      expect(wrapper.findAll('.text-accordion-item')[0].classes()).not.toContain('expanded')
      expect(wrapper.findAll('.text-accordion-body')).toHaveLength(0)
    } finally {
      wrapper.unmount()
    }
  })

  it('resets to fully collapsed when show() is called again for a new topic', async () => {
    const wrapper = mount(Texts, { attachTo: document.body })
    try {
      wrapper.vm.show(TOPIC)
      await wrapper.findAll('.text-accordion-header')[0].trigger('click')
      expect(wrapper.findAll('.text-accordion-body')).toHaveLength(1)

      wrapper.vm.show({ texts: [{ text_id: 't3', number: 1, title: 'New topic text', body: 'Body.' }] })

      expect(wrapper.findAll('.text-accordion-body')).toHaveLength(0)
      expect(wrapper.findAll('.text-accordion-item')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })

  describe('gender style config', () => {
    it('leaves bold words as plain <strong> when the config is off, even if a gender match exists', async () => {
      vi.mocked(api.getWords).mockResolvedValue({
        lang: 'en',
        words: [{ word_id: 'w1', original: 'friend', filename: 'f.png', sentence: '', cue: '', gender_id: 'masculine', particle_type: 'not_apply' }],
      })
      const wrapper = mount(Texts, { attachTo: document.body })
      try {
        wrapper.vm.show(TOPIC, 'en', false)
        await wrapper.findAll('.text-accordion-header')[0].trigger('click')

        const strong = wrapper.findAll('.text-accordion-body strong')[0]
        expect(strong.text()).toBe('friend')
        expect(strong.attributes('style')).toBeUndefined()
        expect(api.getWords).not.toHaveBeenCalled()
      } finally {
        wrapper.unmount()
      }
    })

    it('colors and decorates a bold word matching the catalog when the config is on', async () => {
      vi.mocked(api.getWords).mockResolvedValue({
        lang: 'en',
        words: [{ word_id: 'w1', original: 'friend', filename: 'f.png', sentence: '', cue: '', gender_id: 'masculine', particle_type: 'not_apply' }],
      })
      const wrapper = mount(Texts, { attachTo: document.body })
      try {
        wrapper.vm.show(TOPIC, 'en', true)
        await flushPromises()
        await wrapper.findAll('.text-accordion-header')[0].trigger('click')

        const strongs = wrapper.findAll('.text-accordion-body strong')
        expect(strongs[0].text()).toBe('|friend')
        expect(strongs[0].attributes('style')).toContain('color')
        // "soon" has no catalog match, so it falls back to plain <strong>
        expect(strongs[1].text()).toBe('soon')
        expect(strongs[1].attributes('style')).toBeUndefined()
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('Korean particle coloring', () => {
    it('colors a bold particle word even when the gender-style config is off', async () => {
      vi.mocked(api.getWords).mockResolvedValue({
        lang: 'ko',
        words: [{ word_id: 'w1', original: '랑', filename: 'and.png', sentence: '', cue: '', gender_id: 'not_apply', particle_type: 'addition' }],
      })
      const topic = {
        texts: [{ text_id: 't1', number: 1, title: 'Fruit', body: '사과**랑** 바나나를 먹어요.' }],
      }
      const wrapper = mount(Texts, { attachTo: document.body })
      try {
        wrapper.vm.show(topic, 'pt-ko', false)
        await flushPromises()
        await wrapper.findAll('.text-accordion-header')[0].trigger('click')

        const strong = wrapper.findAll('.text-accordion-body strong')[0]
        expect(strong.text()).toBe('랑')
        expect(strong.attributes('style')).toContain('color')
        expect(api.getWords).toHaveBeenCalledWith('pt-ko')
      } finally {
        wrapper.unmount()
      }
    })
  })
})
