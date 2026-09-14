import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Texts from './Texts.vue'

const TOPIC = {
  texts: [
    { text_id: 't1', number: 1, title: 'Greetings', body: 'Hello, **friend**!\nSee you **soon**.' },
    { text_id: 't2', number: 2, title: 'Farewells', body: 'Goodbye.' },
  ],
}

describe('Texts', () => {
  it('renders **bold** spans as <strong>', () => {
    const wrapper = mount(Texts, { attachTo: document.body })
    wrapper.vm.show(TOPIC)

    const strongs = wrapper.findAll('#text-reader-body strong')
    expect(strongs).toHaveLength(2)
    expect(strongs[0].text()).toBe('friend')
    expect(strongs[1].text()).toBe('soon')

    expect(wrapper.find('#text-reader-title').text()).toBe('Greetings')
    expect(wrapper.find<HTMLButtonElement>('#text-prev-btn').element.disabled).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('#text-next-btn').element.disabled).toBe(false)

    wrapper.unmount()
  })

  it('advances to the next text without a bold span, disabling next-btn on the last text', async () => {
    const wrapper = mount(Texts, { attachTo: document.body })
    wrapper.vm.show(TOPIC)

    await wrapper.find('#text-next-btn').trigger('click')

    expect(wrapper.find('#text-reader-title').text()).toBe('Farewells')
    expect(wrapper.findAll('#text-reader-body strong')).toHaveLength(0)
    expect(wrapper.find<HTMLButtonElement>('#text-next-btn').element.disabled).toBe(true)

    wrapper.unmount()
  })
})
