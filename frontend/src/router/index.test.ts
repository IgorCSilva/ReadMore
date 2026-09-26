import { beforeEach, describe, expect, it } from 'vitest'
import { logoutUser, setUserEmail } from '../shared/currentUser'
import router from './index'

describe('router auth guard', () => {
  beforeEach(() => {
    localStorage.clear()
    logoutUser()
  })

  it('redirects to sign-in when navigating to a protected route while signed out', async () => {
    await router.push('/home')

    expect(router.currentRoute.value.name).toBe('sign-in')
  })

  it('allows a protected route through once an email is signed in', async () => {
    setUserEmail('a@b.com')

    await router.push('/home')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('does not gate public routes', async () => {
    await router.push('/signin')
    expect(router.currentRoute.value.name).toBe('sign-in')

    await router.push('/')
    expect(router.currentRoute.value.name).toBe('presentation')
  })

  it('redirects an unknown path to sign-in when signed out', async () => {
    await router.push('/asdf')

    expect(router.currentRoute.value.name).toBe('sign-in')
  })

  it('redirects an unknown path to home when signed in', async () => {
    setUserEmail('a@b.com')

    await router.push('/asdf')

    expect(router.currentRoute.value.name).toBe('home')
  })
})
