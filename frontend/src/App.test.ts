import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomePage from './pages/HomePage.vue'
import LibraryPage from './pages/LibraryPage.vue'

describe('App', () => {
  it('mounts the persistent chrome and routes "/" to the Home page', async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: HomePage },
        { path: '/library', name: 'library', component: LibraryPage },
      ],
    })
    router.push('/')
    await router.isReady()

    // App.vue's routed pages use global document.getElementById lookups
    // (not scoped to the component), so it needs to be attached to a real
    // document — @vue/test-utils mounts to a detached container by default.
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router] } })

    expect(wrapper.find('.toast-container').exists()).toBe(true)
    expect(wrapper.find('.bottom-bar').exists()).toBe(true)
    expect(wrapper.find('.home-topbar').exists()).toBe(true)

    wrapper.unmount()
  })
})
