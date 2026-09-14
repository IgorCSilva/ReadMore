import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import Exercises from './Exercises.vue'

vi.mock('../../shared/api', () => ({
  getWords: vi.fn(),
}))

const WORD = {
  word_id: 'en-0001',
  original: 'hello',
  filename: 'hello.webp',
  sentence: 'Hi!',
  cue: 'a greeting',
}

describe('Exercises', () => {
  it('renders a fill-in-the-blank exercise with its cue image', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'english', words: [WORD] })

    const topic = {
      exercises: [
        {
          exercise_id: 'ex-01',
          title: 'Exercise 1',
          items: [{ sentence: '_____! Nice to meet you.', word_ids: ['en-0001'] }],
        },
      ],
    }

    const wrapper = mount(Exercises, { attachTo: document.body })
    await wrapper.vm.show('english', topic)

    expect(wrapper.find('.exercise-title').text()).toBe('Exercise 1')
    expect(wrapper.find('.exercise-input').exists()).toBe(true)
    expect(wrapper.find('.exercise-cue-image').attributes('alt')).toBe('hello')
    // Not isVisible(): the outer #topic-exercises-panel starts with
    // style="display:none" in the template (the shell only shows it once
    // the Exercises tab is active, which this isolated test never
    // simulates), so ancestor-aware visibility checks would always read
    // false here regardless of this component's own logic. Check the style
    // this component actually sets instead.
    expect(wrapper.find<HTMLElement>('#exercises-empty-state').element.style.display).toBe('none')
    expect(wrapper.find<HTMLElement>('#exercises-list').element.style.display).toBe('flex')

    wrapper.unmount()
  })

  it('shows the empty state when the topic has no exercises', async () => {
    const wrapper = mount(Exercises, { attachTo: document.body })
    await wrapper.vm.show('english', { exercises: [] })

    expect(wrapper.find<HTMLElement>('#exercises-empty-state').element.style.display).toBe('block')
    expect(wrapper.find<HTMLElement>('#exercises-list').element.style.display).toBe('none')

    wrapper.unmount()
  })
})
