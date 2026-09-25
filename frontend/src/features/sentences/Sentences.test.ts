import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import Sentences from './Sentences.vue'

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return {
    ...actual,
    getWords: vi.fn(),
  }
})

beforeEach(() => {
  vi.mocked(api.getWords).mockClear()
})

const TOPIC = {
  sentences: [
    { sentence_number: 1, content: 'Said **hi** and left.' },
    { sentence_number: 2, content: 'Plain sentence.' },
  ],
}

describe('Sentences', () => {
  it('lists every sentence with its number and rendered content', () => {
    const wrapper = mount(Sentences, { attachTo: document.body })
    try {
      wrapper.vm.show(TOPIC)

      const items = wrapper.findAll('.sentence-item')
      expect(items).toHaveLength(2)
      expect(wrapper.findAll('.sentence-item-number').map((n) => n.text())).toEqual(['1', '2'])

      const strongs = wrapper.findAll('.sentence-item-content strong')
      expect(strongs).toHaveLength(1)
      expect(strongs[0].text()).toBe('hi')
      expect(items[1].find('.sentence-item-content').text()).toBe('Plain sentence.')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an empty-state message instead of the list when the topic has no sentences', () => {
    const wrapper = mount(Sentences, { attachTo: document.body })
    try {
      wrapper.vm.show({ sentences: [] })

      expect(wrapper.find('.sentence-item').exists()).toBe(false)
      expect(wrapper.get<HTMLElement>('#sentences-empty-state').element.style.display).toBe('block')
      expect(wrapper.get<HTMLElement>('#sentences-list').element.style.display).toBe('none')
    } finally {
      wrapper.unmount()
    }
  })

  it('resets to the new topic\'s sentences when show() is called again', () => {
    const wrapper = mount(Sentences, { attachTo: document.body })
    try {
      wrapper.vm.show(TOPIC)
      expect(wrapper.findAll('.sentence-item')).toHaveLength(2)

      wrapper.vm.show({ sentences: [{ sentence_number: 1, content: 'New topic sentence.' }] })

      const items = wrapper.findAll('.sentence-item')
      expect(items).toHaveLength(1)
      expect(items[0].find('.sentence-item-content').text()).toBe('New topic sentence.')
    } finally {
      wrapper.unmount()
    }
  })

  describe('Korean particle coloring', () => {
    it('colors different particle types differently, and leaves unmatched bold words plain', async () => {
      vi.mocked(api.getWords).mockResolvedValue({
        lang: 'ko',
        words: [
          { word_id: 'w1', original: '는', filename: 'topic.png', sentence: '', cue: '', gender_id: 'not_apply', particle_type: 'topic' },
          { word_id: 'w2', original: '랑', filename: 'and.png', sentence: '', cue: '', gender_id: 'not_apply', particle_type: 'addition' },
        ],
      })
      const topic = {
        sentences: [{ sentence_number: 1, content: '고양이**는** 개**랑** 논다.' }],
      }
      const wrapper = mount(Sentences, { attachTo: document.body })
      try {
        wrapper.vm.show(topic, 'pt-ko')
        await flushPromises()

        const strongs = wrapper.findAll('.sentence-item-content strong')
        expect(strongs.map((s) => s.text())).toEqual(['는', '랑'])
        const topicColor = strongs[0].attributes('style')
        const additionColor = strongs[1].attributes('style')
        expect(topicColor).toContain('color')
        expect(additionColor).toContain('color')
        expect(topicColor).not.toBe(additionColor)
        expect(api.getWords).toHaveBeenCalledWith('pt-ko')
      } finally {
        wrapper.unmount()
      }
    })

    it('does not fetch words for a non-Korean pair', () => {
      const wrapper = mount(Sentences, { attachTo: document.body })
      try {
        wrapper.vm.show(TOPIC, 'pt-en')
        expect(api.getWords).not.toHaveBeenCalled()
      } finally {
        wrapper.unmount()
      }
    })
  })
})
