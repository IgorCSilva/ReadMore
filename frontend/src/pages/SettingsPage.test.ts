import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../shared/api'
import { resetLangPreferenceForTests } from '../shared/languagePreference'
import { getNotifications } from '../shared/notifications'
import SettingsPage from './SettingsPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return {
    ...actual,
    getLanguages: vi.fn(),
  }
})

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

async function mountPage() {
  const wrapper = mount(SettingsPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

function originOptions(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.settings-section')[0].findAll('.lang-option')
}

function targetOptions(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.settings-section')[1].findAll('.lang-option')
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetLangPreferenceForTests()
    document.documentElement.removeAttribute('data-lang')
    clearNotifications()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists each whitelisted origin/target with its flag and native country name', async () => {
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'pt-ko'] })
    const wrapper = await mountPage()
    try {
      const origins = originOptions(wrapper)
      expect(origins).toHaveLength(1)
      expect(origins[0].get('.lang-option-country').text()).toBe('Brasil')
      expect(origins[0].get('img').attributes('src')).toBe('/images/flags/brazil.png')
      expect(origins[0].get('img').attributes('alt')).toBe('Brasil')

      const targets = targetOptions(wrapper)
      expect(targets.map((o) => o.get('.lang-option-country').text())).toEqual(['England', 'España', '한국'])
    } finally {
      wrapper.unmount()
    }
  })

  it('pre-selects whatever pair is currently saved', async () => {
    localStorage.setItem('readmore_lang_pair', 'pt-es')
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'pt-ko'] })
    const wrapper = await mountPage()
    try {
      const selected = targetOptions(wrapper).find((o) => o.classes().includes('selected'))
      expect(selected?.get('.lang-option-country').text()).toBe('España')
    } finally {
      wrapper.unmount()
    }
  })

  it('defaults to pt-en when nothing is saved yet', async () => {
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'pt-ko'] })
    const wrapper = await mountPage()
    try {
      const selected = targetOptions(wrapper).find((o) => o.classes().includes('selected'))
      expect(selected?.get('.lang-option-country').text()).toBe('England')
    } finally {
      wrapper.unmount()
    }
  })

  it('switching origin restricts and resets the target to one actually valid for it', async () => {
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'en-es'] })
    const wrapper = await mountPage()
    try {
      expect(originOptions(wrapper).map((o) => o.get('.lang-option-country').text())).toEqual(['Brasil', 'England'])

      await originOptions(wrapper)[1].trigger('click') // switch origin to "en"

      expect(targetOptions(wrapper).map((o) => o.get('.lang-option-country').text())).toEqual(['España'])
      expect(targetOptions(wrapper)[0].classes()).toContain('selected')
    } finally {
      wrapper.unmount()
    }
  })

  it('Save persists the pair, applies the target accent immediately, and confirms with a toast', async () => {
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'pt-ko'] })
    const wrapper = await mountPage()
    try {
      const korean = targetOptions(wrapper).find((o) => o.get('.lang-option-country').text() === '한국')
      await korean?.trigger('click')

      await wrapper.get('.settings-save-btn').trigger('click')

      expect(localStorage.getItem('readmore_lang_pair')).toBe('pt-ko')
      expect(document.documentElement.getAttribute('data-lang')).toBe('ko')
      expect(getNotifications().map((n) => n.type)).toContain('success')
    } finally {
      wrapper.unmount()
    }
  })
})
