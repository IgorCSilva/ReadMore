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
    getUser: vi.fn(),
  }
})

// Most tests aren't exercising the per-user gating itself — they mirror the
// old "every whitelisted pair is enabled" behavior by default, so existing
// assertions about which flags render/select stay valid unchanged. Tests
// about the gating itself override this per-call.
function mockAllPairsEnabled(languages: string[]) {
  vi.mocked(api.getUser).mockResolvedValue({ exists: true, language_pairs: languages })
}

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

  it('shows a loading spinner in both language sections while user data is in flight, then the flags', async () => {
    let resolveUser: (value: { exists: boolean; language_pairs: string[] }) => void = () => {}
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es'] })
    vi.mocked(api.getUser).mockReturnValue(new Promise((resolve) => { resolveUser = resolve }))

    const wrapper = mount(SettingsPage, { attachTo: document.body })
    await flushPromises()
    try {
      expect(wrapper.findAll('.settings-loading')).toHaveLength(2)
      expect(wrapper.find('.lang-options').exists()).toBe(false)

      resolveUser({ exists: true, language_pairs: ['pt-en', 'pt-es'] })
      await flushPromises()

      expect(wrapper.findAll('.settings-loading')).toHaveLength(0)
      expect(originOptions(wrapper).length).toBeGreaterThan(0)
    } finally {
      wrapper.unmount()
    }
  })

  it('skips the loading spinner on a later mount, rendering cached flags instantly instead of waiting on a fresh request', async () => {
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es'] })
    mockAllPairsEnabled(['pt-en', 'pt-es'])
    const first = await mountPage()
    first.unmount()

    // Never-resolving promises for the second mount's own requests — if the
    // component were still blocking on them (i.e. caching wasn't working),
    // the assertions below would fail instead of passing immediately.
    vi.mocked(api.getLanguages).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getUser).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(SettingsPage, { attachTo: document.body })
    await flushPromises()
    try {
      expect(wrapper.findAll('.settings-loading')).toHaveLength(0)
      expect(originOptions(wrapper).length).toBeGreaterThan(0)
    } finally {
      wrapper.unmount()
    }
  })

  it('lists each whitelisted origin/target with its flag and native country name', async () => {
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'pt-ko'] })
    mockAllPairsEnabled(['pt-en', 'pt-es', 'pt-ko'])
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
    mockAllPairsEnabled(['pt-en', 'pt-es', 'pt-ko'])
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
    mockAllPairsEnabled(['pt-en', 'pt-es', 'pt-ko'])
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
    mockAllPairsEnabled(['pt-en', 'pt-es', 'en-es'])
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
    mockAllPairsEnabled(['pt-en', 'pt-es', 'pt-ko'])
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

  it('disables origin/target flags this user has no enabled pair for, but still shows them', async () => {
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'pt-ko', 'en-es'] })
    mockAllPairsEnabled(['pt-en', 'pt-ko'])
    const wrapper = await mountPage()
    try {
      const origins = originOptions(wrapper)
      const pt = origins.find((o) => o.get('.lang-option-country').text() === 'Brasil')
      const en = origins.find((o) => o.get('.lang-option-country').text() === 'England')
      expect(pt?.attributes('disabled')).toBeUndefined()
      expect(en?.attributes('disabled')).toBeDefined()

      const targets = targetOptions(wrapper)
      const english = targets.find((o) => o.get('.lang-option-country').text() === 'England')
      const spanish = targets.find((o) => o.get('.lang-option-country').text() === 'España')
      const korean = targets.find((o) => o.get('.lang-option-country').text() === '한국')
      expect(english?.attributes('disabled')).toBeUndefined()
      expect(spanish?.attributes('disabled')).toBeDefined()
      expect(korean?.attributes('disabled')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('does nothing when a disabled origin or target flag is clicked', async () => {
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'en-es'] })
    mockAllPairsEnabled(['pt-en'])
    const wrapper = await mountPage()
    try {
      const spanishTarget = targetOptions(wrapper).find((o) => o.get('.lang-option-country').text() === 'España')
      await spanishTarget?.trigger('click')
      expect(spanishTarget?.classes()).not.toContain('selected')

      const englishOrigin = originOptions(wrapper).find((o) => o.get('.lang-option-country').text() === 'England')
      await englishOrigin?.trigger('click')
      expect(englishOrigin?.classes()).not.toContain('selected')

      // Neither disabled click changed anything — Portuguese/English (the
      // one enabled pair) is still what's selected and savable.
      const englishTarget = targetOptions(wrapper).find((o) => o.get('.lang-option-country').text() === 'England')
      expect(englishTarget?.classes()).toContain('selected')
      expect(wrapper.get('.settings-save-btn').attributes('disabled')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })

  it('falls back to an enabled pair when the saved preference is no longer enabled', async () => {
    localStorage.setItem('readmore_lang_pair', 'pt-es')
    vi.mocked(api.getLanguages).mockResolvedValue({ languages: ['pt-en', 'pt-es', 'pt-ko'] })
    mockAllPairsEnabled(['pt-ko'])
    const wrapper = await mountPage()
    try {
      const selected = targetOptions(wrapper).find((o) => o.classes().includes('selected'))
      expect(selected?.get('.lang-option-country').text()).toBe('한국')
    } finally {
      wrapper.unmount()
    }
  })
})
