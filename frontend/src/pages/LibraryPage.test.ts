import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LibraryPage from './LibraryPage.vue'

describe('LibraryPage', () => {
  it('mounts and renders the topic tab bar', () => {
    // LibraryPage's ported script uses global document.getElementById lookups
    // (not scoped to the component), so it needs to be attached to a real
    // document — @vue/test-utils mounts to a detached container by default.
    const wrapper = mount(LibraryPage, { attachTo: document.body })

    expect(wrapper.find('#topic-tab-flashcards').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-texts').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-sentences').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-reading').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-typing').exists()).toBe(true)
    expect(wrapper.find('#topic-tab-exercises').exists()).toBe(true)

    wrapper.unmount()
  })
})
