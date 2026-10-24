import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { resetLangPreferenceForTests } from '../../shared/languagePreference'
import { getNotifications } from '../../shared/notifications'
import Conversation from './Conversation.vue'

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>()
  return { ...actual, sendChatMessage: vi.fn() }
})

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

async function sendMessage(wrapper: ReturnType<typeof mount>, text: string) {
  await wrapper.find('.conversation-input').setValue(text)
  await wrapper.find('.conversation-input-row').trigger('submit')
}

describe('Conversation', () => {
  beforeEach(() => {
    localStorage.clear()
    resetLangPreferenceForTests()
    clearNotifications()
    vi.mocked(api.sendChatMessage).mockReset()
  })

  it('sends a message and appends both the user turn and the AI reply', async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValue({ reply: '¡Hola! ¿Cómo estás?' })
    const wrapper = mount(Conversation, { attachTo: document.body })

    try {
      await sendMessage(wrapper, 'Hola')
      await vi.waitFor(() => {
        expect(wrapper.findAll('.conversation-bubble-ai')).toHaveLength(1)
      })

      expect(api.sendChatMessage).toHaveBeenCalledWith({
        lang: 'pt-en',
        level: 'B1',
        message: 'Hola',
        history: [],
      })
      expect(wrapper.find('.conversation-bubble-user').text()).toBe('Hola')
      expect(wrapper.find('.conversation-bubble-ai').text()).toBe('¡Hola! ¿Cómo estás?')
      expect(wrapper.find<HTMLInputElement>('.conversation-input').element.value).toBe('')
    } finally {
      wrapper.unmount()
    }
  })

  it('sends accumulated history on the next message', async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValue({ reply: 'reply-1' })
    const wrapper = mount(Conversation, { attachTo: document.body })

    try {
      await sendMessage(wrapper, 'first')
      await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(1))

      vi.mocked(api.sendChatMessage).mockResolvedValue({ reply: 'reply-2' })
      await sendMessage(wrapper, 'second')
      await vi.waitFor(() => expect(api.sendChatMessage).toHaveBeenCalledTimes(2))

      expect(api.sendChatMessage).toHaveBeenLastCalledWith({
        lang: 'pt-en',
        level: 'B1',
        message: 'second',
        history: [
          { role: 'user', content: 'first' },
          { role: 'ai', content: 'reply-1' },
        ],
      })
    } finally {
      wrapper.unmount()
    }
  })

  it('changing the level mid-conversation clears the history', async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValue({ reply: 'reply-1' })
    const wrapper = mount(Conversation, { attachTo: document.body })

    try {
      await sendMessage(wrapper, 'first')
      await vi.waitFor(() => expect(wrapper.findAll('.conversation-bubble-ai')).toHaveLength(1))

      await wrapper.find('.conversation-level-select').setValue('C1')

      expect(wrapper.findAll('.conversation-bubble')).toHaveLength(0)
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an error toast instead of crashing when the request fails', async () => {
    vi.mocked(api.sendChatMessage).mockRejectedValue(new Error('AI is temporarily unavailable, try again shortly'))
    const wrapper = mount(Conversation, { attachTo: document.body })

    try {
      await sendMessage(wrapper, 'Hola')
      await vi.waitFor(() => {
        expect(getNotifications()[0]).toMatchObject({
          type: 'error',
          message: 'AI is temporarily unavailable, try again shortly',
        })
      })

      // the user's own message still shows — only the AI side failed
      expect(wrapper.find('.conversation-bubble-user').text()).toBe('Hola')
      expect(wrapper.findAll('.conversation-bubble-ai')).toHaveLength(0)
    } finally {
      wrapper.unmount()
    }
  })
})
