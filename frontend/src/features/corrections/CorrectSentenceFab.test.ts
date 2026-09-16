import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { setCurrentSelection } from '../../shared/currentSelection'
import { getNotifications } from '../../shared/notifications'
import CorrectSentenceFab from './CorrectSentenceFab.vue'

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return { ...actual, submitCorrection: vi.fn() }
})

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

describe('CorrectSentenceFab', () => {
  beforeEach(() => {
    clearNotifications()
    vi.mocked(api.submitCorrection).mockReset()
    setCurrentSelection({ lang: 'pt-en', chapterNumber: null, topicNumber: null })
  })

  it('is hidden when no topic is selected', () => {
    const wrapper = mount(CorrectSentenceFab, { attachTo: document.body })

    expect(wrapper.find('.correct-fab').exists()).toBe(false)

    wrapper.unmount()
  })

  it('opens the modal and submits split, trimmed current/correction lists', async () => {
    setCurrentSelection({ lang: 'pt-en', chapterNumber: 2, topicNumber: 4 })
    vi.mocked(api.submitCorrection).mockResolvedValue(new Response())
    const wrapper = mount(CorrectSentenceFab, { attachTo: document.body })

    await wrapper.find('.correct-fab').trigger('click')
    expect(wrapper.find('.correction-modal').exists()).toBe(true)

    const textareas = wrapper.findAll('textarea')
    await textareas[0].setValue('meu, minha')
    await textareas[1].setValue('mi')
    await wrapper.find('.correction-submit').trigger('click')

    await vi.waitFor(() => {
      expect(api.submitCorrection).toHaveBeenCalled()
    })
    expect(api.submitCorrection).toHaveBeenCalledWith({
      chapter_number: 2,
      topic_number: 4,
      lang: 'pt-en',
      current: ['meu', 'minha'],
      correction: ['mi'],
    })
    expect(getNotifications()[0]).toMatchObject({ type: 'success' })
    expect(wrapper.find('.correction-modal').exists()).toBe(false)

    wrapper.unmount()
  })

  it('rejects submission when either field is empty, without calling the API', async () => {
    setCurrentSelection({ lang: 'pt-en', chapterNumber: 2, topicNumber: 4 })
    const wrapper = mount(CorrectSentenceFab, { attachTo: document.body })

    await wrapper.find('.correct-fab').trigger('click')
    await wrapper.findAll('textarea')[0].setValue('avó')
    await wrapper.find('.correction-submit').trigger('click')

    expect(api.submitCorrection).not.toHaveBeenCalled()
    expect(getNotifications()[0]).toMatchObject({ type: 'error' })

    wrapper.unmount()
  })

  it('shows an error notification and keeps the modal open on API failure', async () => {
    setCurrentSelection({ lang: 'pt-en', chapterNumber: 2, topicNumber: 4 })
    vi.mocked(api.submitCorrection).mockRejectedValue(new api.HttpError(400, 'bad request'))
    const wrapper = mount(CorrectSentenceFab, { attachTo: document.body })

    await wrapper.find('.correct-fab').trigger('click')
    await wrapper.findAll('textarea')[0].setValue('avó')
    await wrapper.findAll('textarea')[1].setValue('abuela')
    await wrapper.find('.correction-submit').trigger('click')

    await vi.waitFor(() => {
      expect(getNotifications().some((n) => n.type === 'error')).toBe(true)
    })
    expect(wrapper.find('.correction-modal').exists()).toBe(true)

    wrapper.unmount()
  })
})
