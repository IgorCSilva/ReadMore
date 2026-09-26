import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import * as api from '../shared/api'
import { getCurrentUser, logoutUser, setUserEmail } from '../shared/currentUser'
import type { UserResponse } from '../shared/types'
import SignInPage from './SignInPage.vue'

vi.mock('../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/api')>()
  return { ...actual, getUser: vi.fn() }
})

const getUser = vi.mocked(api.getUser)

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
    getUser.mockReset()
    getUser.mockResolvedValue({ exists: true, language_pairs: [] })
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

        expect(getUser).toHaveBeenCalledWith('new@example.com')
        expect(getCurrentUser().email).toBe('new@example.com')
        expect(router.currentRoute.value.path).toBe('/home')
      } finally {
        wrapper.unmount()
      }
    })

    it('shows a loading state while the account check is in flight, then clears it', async () => {
      let resolveCheck: (value: UserResponse) => void = () => {}
      getUser.mockReturnValue(new Promise((resolve) => { resolveCheck = resolve }))

      const { wrapper } = await mountPage()
      try {
        await wrapper.get('.signin-input').setValue('new@example.com')
        await wrapper.get('.signin-form').trigger('submit')
        await flushPromises()

        expect(wrapper.find('.signin-spinner').exists()).toBe(true)
        expect(wrapper.get('.signin-submit-btn').attributes('disabled')).toBeDefined()

        resolveCheck({ exists: true, language_pairs: [] })
        await flushPromises()

        expect(wrapper.find('.signin-spinner').exists()).toBe(false)
        expect(wrapper.get('.signin-submit-btn').attributes('disabled')).toBeUndefined()
      } finally {
        wrapper.unmount()
      }
    })

    it('shows "Account not found." and does not navigate when the email is not registered', async () => {
      getUser.mockResolvedValue({ exists: false, language_pairs: [] })
      const { wrapper, router } = await mountPage()
      try {
        await wrapper.get('.signin-input').setValue('nobody@example.com')
        await wrapper.get('.signin-form').trigger('submit')
        await flushPromises()

        expect(wrapper.get('.signin-error').text()).toBe('Account not found.')
        expect(getCurrentUser().email).toBeNull()
        expect(router.currentRoute.value.path).toBe('/signin')
      } finally {
        wrapper.unmount()
      }
    })

    it('shows a generic error and does not navigate when the account check fails', async () => {
      getUser.mockRejectedValue(new Error('network request failed'))
      const { wrapper, router } = await mountPage()
      try {
        await wrapper.get('.signin-input').setValue('new@example.com')
        await wrapper.get('.signin-form').trigger('submit')
        await flushPromises()

        expect(wrapper.get('.signin-error').text()).toBeTruthy()
        expect(getCurrentUser().email).toBeNull()
        expect(router.currentRoute.value.path).toBe('/signin')
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
