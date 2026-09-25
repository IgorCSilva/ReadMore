import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomePage from './pages/HomePage.vue'
import LibraryPage from './pages/LibraryPage.vue'
import PartFlowPage from './pages/PartFlowPage.vue'
import PresentationPage from './pages/PresentationPage.vue'

function testRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'presentation', component: PresentationPage, meta: { hideGlobalBottomBar: true } },
      { path: '/signin', name: 'sign-in', component: { template: '<div>sign-in</div>' } },
      { path: '/home', name: 'home', component: HomePage },
      { path: '/library', name: 'library', component: LibraryPage },
      { path: '/settings', name: 'settings', component: { template: '<div>settings</div>' } },
      { path: '/part/:topicId/:partNumber', name: 'part-flow', component: PartFlowPage, meta: { hideGlobalBottomBar: true } },
    ],
  })
}

describe('App', () => {
  it('mounts the persistent chrome and routes "/home" to the Home page', async () => {
    const router = testRouter()
    router.push('/home')
    await router.isReady()

    // App.vue's routed pages use global document.getElementById lookups
    // (not scoped to the component), so it needs to be attached to a real
    // document — @vue/test-utils mounts to a detached container by default.
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router] } })

    expect(wrapper.find('.toast-container').exists()).toBe(true)
    expect(wrapper.find('.bottom-bar').exists()).toBe(true)
    expect(wrapper.find('.home-topbar').exists()).toBe(true)

    const bottomBarLinks = wrapper.findAll('.bottom-bar-item')
    expect(bottomBarLinks).toHaveLength(2)
    expect(bottomBarLinks[0].attributes('href')).toBe('/home')
    expect(bottomBarLinks[1].attributes('href')).toBe('/settings')

    wrapper.unmount()
  })

  it('hides the global bottom bar on the part-flow route', async () => {
    const router = testRouter()
    router.push({ name: 'part-flow', params: { topicId: 't1', partNumber: '1' } })
    await router.isReady()

    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router] } })

    expect(wrapper.find('.bottom-bar').exists()).toBe(false)
    expect(wrapper.find('.flow-topbar').exists()).toBe(true)

    wrapper.unmount()
  })

  it('routes "/" to the public Presentation page, with the global bottom bar hidden', async () => {
    const router = testRouter()
    router.push('/')
    await router.isReady()

    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router] } })

    expect(wrapper.find('.bottom-bar').exists()).toBe(false)
    expect(wrapper.find('.pres-topbar').exists()).toBe(true)

    wrapper.unmount()
  })
})
