import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Sentences from './Sentences.vue'

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
})
