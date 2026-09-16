import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  gender_id: 'not_apply',
}

describe('Exercises', () => {
  beforeEach(() => {
    localStorage.clear()
  })

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

  it('renders an explicit type: "fill_in_the_blank" the same as the legacy untyped shape', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'english', words: [WORD] })

    const topic = {
      exercises: [
        {
          exercise_id: 'ex-01',
          title: 'Exercise 1',
          type: 'fill_in_the_blank',
          items: [{ sentence: '_____! Nice to meet you.', word_ids: ['en-0001'] }],
        },
      ],
    }

    const wrapper = mount(Exercises, { attachTo: document.body })
    await wrapper.vm.show('english', topic)

    expect(wrapper.find('.exercise-input').exists()).toBe(true)
    expect(wrapper.find('.exercise-cue-image').attributes('alt')).toBe('hello')

    wrapper.unmount()
  })

  it('renders a sentence_completion exercise with its situation line and blank', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'english', words: [WORD] })

    const topic = {
      exercises: [
        {
          exercise_id: 'ex-02',
          title: 'Exercise 2',
          type: 'sentence_completion',
          items: [
            {
              situation: 'Someone greets you at the door.',
              sentence: '_____! Nice to meet you.',
              word_ids: ['en-0001'],
            },
          ],
        },
      ],
    }

    const wrapper = mount(Exercises, { attachTo: document.body })
    await wrapper.vm.show('english', topic)

    expect(wrapper.find('.exercise-situation').text()).toBe('Someone greets you at the door.')
    expect(wrapper.find('.exercise-input').exists()).toBe(true)
    expect(wrapper.find('.exercise-cue-image').attributes('alt')).toBe('hello')

    wrapper.unmount()
  })

  it('renders a vocabulary_classification exercise like the legacy classify shape', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'english', words: [WORD] })

    const topic = {
      exercises: [
        {
          exercise_id: 'ex-03',
          title: 'Exercise 3',
          type: 'vocabulary_classification',
          word_bank: ['en-0001'],
          categories: [{ title: 'Greetings' }, { title: 'Other' }],
        },
      ],
    }

    const wrapper = mount(Exercises, { attachTo: document.body })
    await wrapper.vm.show('english', topic)

    expect(wrapper.find('.exercise-word-bank').exists()).toBe(true)
    expect(wrapper.find('.exercise-cue-image').attributes('alt')).toBe('hello')
    expect(wrapper.find('.exercise-category-title').text()).toBe('Greetings')

    wrapper.unmount()
  })

  it('renders a guided_open_response exercise as independent numbered mini-dialogues', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'english', words: [WORD] })

    const topic = {
      exercises: [
        {
          exercise_id: 'ex-04',
          title: 'Exercise 4',
          type: 'guided_open_response',
          items: [
            {
              lines: [
                { speaker: 'Friend', text: 'My **mother** is a doctor.' },
                { speaker: 'You', hint: 'describe someone in your family' },
              ],
            },
          ],
        },
      ],
    }

    const wrapper = mount(Exercises, { attachTo: document.body })
    await wrapper.vm.show('english', topic)

    expect(wrapper.find('.exercise-guided-list').exists()).toBe(true)
    expect(wrapper.find('.exercise-open-response strong').text()).toBe('mother')
    expect(wrapper.find('.exercise-open-input').attributes('placeholder')).toBe(
      'describe someone in your family',
    )

    wrapper.unmount()
  })

  it('renders comprehension_question_answering and guided_production via the same open-ended shape', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'english', words: [WORD] })

    const topic = {
      exercises: [
        {
          exercise_id: 'ex-05',
          title: 'Exercise 5',
          type: 'comprehension_question_answering',
          items: [{ statement: 'Sofía says her **family** is big.', question: 'What can you infer?' }],
        },
        {
          exercise_id: 'ex-06',
          title: 'Exercise 6',
          type: 'guided_production',
          items: [{ model: 'Sofía says her **mother** is kind.', prompt: 'Describe someone else now.' }],
        },
      ],
    }

    const wrapper = mount(Exercises, { attachTo: document.body })
    await wrapper.vm.show('english', topic)

    const groups = wrapper.findAll('.exercise-open-ended')
    expect(groups.length).toBe(2)
    expect(wrapper.find('.exercise-context strong').exists()).toBe(true)
    expect(wrapper.findAll('.exercise-open-ended-input').length).toBe(2)
    expect(wrapper.findAll('.exercise-prompt')[0].text()).toBe('What can you infer?')
    expect(wrapper.findAll('.exercise-prompt')[1].text()).toBe('Describe someone else now.')

    wrapper.unmount()
  })

  it('renders a short_contextual_dialogue exercise with its trailing comprehension question', async () => {
    vi.mocked(api.getWords).mockResolvedValue({ lang: 'english', words: [WORD] })

    const topic = {
      exercises: [
        {
          exercise_id: 'ex-07',
          title: 'Exercise 7',
          type: 'short_contextual_dialogue',
          lines: [
            { speaker: 'Ana', text: 'Do you know Marco?' },
            { speaker: 'Bea', text: "His **mother** works at a hospital." },
          ],
          question: 'Who works at a hospital?',
        },
      ],
    }

    const wrapper = mount(Exercises, { attachTo: document.body })
    await wrapper.vm.show('english', topic)

    expect(wrapper.find('.exercise-dialogue-comprehension').exists()).toBe(true)
    expect(wrapper.find('.exercise-open-response strong').text()).toBe('mother')
    expect(wrapper.find('.exercise-question-row .exercise-prompt').text()).toBe(
      'Who works at a hospital?',
    )
    expect(wrapper.find('.exercise-question-row .exercise-open-ended-input').exists()).toBe(true)

    wrapper.unmount()
  })
})
