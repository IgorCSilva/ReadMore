import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from './App.vue'

describe('App', () => {
  it('mounts and renders the topic tab bar', () => {
    // App.vue's ported script uses global document.getElementById lookups
    // (not scoped to the component), so it needs to be attached to a real
    // document — @vue/test-utils mounts to a detached container by default.
    const wrapper = mount(App, { attachTo: document.body })

    expect(wrapper.find('#topic-tab-flashcards').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-texts').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-sentences').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-reading').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-typing').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-exercises').exists()).toBe(true)
    expect(wrapper.find('.toast-container').exists()).toBe(true)

    wrapper.unmount()
  })
})
