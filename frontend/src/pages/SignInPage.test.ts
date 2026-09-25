import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { getCurrentUser, logoutUser, setUserEmail } from '../shared/currentUser'
import SignInPage from './SignInPage.vue'

async function mountPage() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'presentation', component: { template: '<div>presentation</div>' } },
      { path: '/signin', name: 'sign-in', component: SignInPage },
      { path: '/home', name: 'home', component: { template: '<div>home</div>' } },
    ],
  })
  router.push('/signin')
  await router.isReady()

  const wrapper = mount(SignInPage, { attachTo: document.body, global: { plugins: [router] } })
  return { wrapper, router }
}

describe('SignInPage', () => {
  beforeEach(() => {
    localStorage.clear()
    logoutUser()
  })

  describe('with nobody currently signed in', () => {
    it('shows just the email form and the password-coming-soon explanation, no "Continue as" block', async () => {
      const { wrapper } = await mountPage()
      try {
        expect(wrapper.find('.signin-current').exists()).toBe(false)
        expect(wrapper.get('.signin-hint').text()).toContain('Password sign-in is coming soon')
      } finally {
        wrapper.unmount()
      }
    })

    it('shows an error and does not navigate when the email is invalid', async () => {
      const { wrapper, router } = await mountPage()
      try {
        await wrapper.get('.signin-input').setValue('not-an-email')
        await wrapper.get('.signin-form').trigger('submit')

        expect(wrapper.get('.signin-error').text()).toBeTruthy()
        expect(router.currentRoute.value.path).toBe('/signin')
      } finally {
        wrapper.unmount()
      }
    })

    it('signs in and redirects to Home when a valid email is submitted', async () => {
      const { wrapper, router } = await mountPage()
      try {
        await wrapper.get('.signin-input').setValue('new@example.com')
        await wrapper.get('.signin-form').trigger('submit')
        await flushPromises()

        expect(getCurrentUser().email).toBe('new@example.com')
        expect(router.currentRoute.value.path).toBe('/home')
      } finally {
        wrapper.unmount()
      }
    })
  })

  describe('with a user already signed in', () => {
    beforeEach(() => {
      setUserEmail('existing@example.com')
    })

    it('offers to continue as the currently signed-in user', async () => {
      const { wrapper } = await mountPage()
      try {
        expect(wrapper.get('.signin-current-btn').text()).toBe('existing@example.com')
      } finally {
        wrapper.unmount()
      }
    })

    it('clicking "Continue as" goes straight to Home without changing the signed-in email', async () => {
      const { wrapper, router } = await mountPage()
      try {
        await wrapper.get('.signin-current-btn').trigger('click')
        await flushPromises()

        expect(getCurrentUser().email).toBe('existing@example.com')
        expect(router.currentRoute.value.path).toBe('/home')
      } finally {
        wrapper.unmount()
      }
    })

    it('typing a different email and submitting replaces the signed-in user, then redirects home', async () => {
      const { wrapper, router } = await mountPage()
      try {
        await wrapper.get('.signin-input').setValue('someone-else@example.com')
        await wrapper.get('.signin-form').trigger('submit')
        await flushPromises()

        expect(getCurrentUser().email).toBe('someone-else@example.com')
        expect(router.currentRoute.value.path).toBe('/home')
      } finally {
        wrapper.unmount()
      }
    })
  })
})
