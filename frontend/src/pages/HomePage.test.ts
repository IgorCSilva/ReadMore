import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import HomePage from './HomePage.vue'

describe('HomePage', () => {
  it('shows a bold "Olá, {email}" in a fixed top bar', async () => {
    // ensureUserEmail() resolves via window.prompt, stubbed in
    // vitest.setup.ts to return "test@example.com" — it runs in onMounted,
    // so the resulting reactive update needs a tick to reach the DOM.
    const wrapper = mount(HomePage, { attachTo: document.body })
    await nextTick()

    const topbar = wrapper.get('.home-topbar')
    const bold = topbar.get('strong')
    expect(bold.text()).toBe('Olá, test@example.com')

    wrapper.unmount()
  })
})
