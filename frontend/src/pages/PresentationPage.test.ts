import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import PresentationPage from './PresentationPage.vue'

async function mountPage() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'presentation', component: PresentationPage },
      { path: '/signin', name: 'sign-in', component: { template: '<div>sign-in</div>' } },
    ],
  })
  router.push('/')
  await router.isReady()

  const wrapper = mount(PresentationPage, { attachTo: document.body, global: { plugins: [router] } })
  return { wrapper, router }
}

function observerInstances() {
  return (window as unknown as { __intersectionObservers: Array<{
    callback: IntersectionObserverCallback
    observe: (el: Element) => void
  }> }).__intersectionObservers
}

describe('PresentationPage', () => {
  beforeEach(() => {
    ;(window as unknown as { __intersectionObservers: unknown[] }).__intersectionObservers = []
  })

  it('shows the ReadMore brand and both auth buttons in the fixed top bar, Sign Up disabled', async () => {
    const { wrapper } = await mountPage()
    try {
      const topbar = wrapper.get('.pres-topbar')
      expect(topbar.get('.pres-brand').text()).toBe('ReadMore')

      const signUp = wrapper.get<HTMLButtonElement>('.pres-btn-ghost')
      expect(signUp.text()).toBe('Sign Up')
      expect(signUp.element.disabled).toBe(true)

      expect(wrapper.get('.pres-btn-solid').text()).toBe('Sign In')
    } finally {
      wrapper.unmount()
    }
  })

  it('the top bar Sign In button navigates to the sign-in page', async () => {
    const { wrapper, router } = await mountPage()
    try {
      await wrapper.get('.pres-btn-solid').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/signin')
    } finally {
      wrapper.unmount()
    }
  })

  it('has a hero headline and a "Get Started" call to action that also goes to sign-in', async () => {
    const { wrapper, router } = await mountPage()
    try {
      expect(wrapper.get('.pres-hero-title').text().length).toBeGreaterThan(0)

      await wrapper.get('.pres-cta-btn').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/signin')
    } finally {
      wrapper.unmount()
    }
  })

  it('lists the 5-step method, numbered in order', async () => {
    const { wrapper } = await mountPage()
    try {
      const steps = wrapper.findAll('.pres-step')
      expect(steps).toHaveLength(5)
      expect(steps.map((s) => s.get('.pres-step-number').text())).toEqual(['1', '2', '3', '4', '5'])
      expect(steps.map((s) => s.get('.pres-step-title').text())).toEqual([
        'See it', 'Say it', 'Write it', 'Read it', 'Hear it',
      ])
    } finally {
      wrapper.unmount()
    }
  })

  it('lists several benefit cards with non-empty copy', async () => {
    const { wrapper } = await mountPage()
    try {
      const cards = wrapper.findAll('.pres-benefit-card')
      expect(cards.length).toBeGreaterThanOrEqual(3)
      for (const card of cards) {
        expect(card.get('h3').text().length).toBeGreaterThan(0)
        expect(card.get('p').text().length).toBeGreaterThan(0)
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('has a footer with the brand, a working Sign In link, a disabled Sign Up, and a copyright line', async () => {
    const { wrapper } = await mountPage()
    try {
      const footer = wrapper.get('.pres-footer')
      expect(footer.get('.pres-footer-brand').text()).toBe('ReadMore')
      expect(footer.get('.pres-footer-links a').attributes('href')).toBe('/signin')
      expect(footer.get<HTMLButtonElement>('.pres-footer-links button').element.disabled).toBe(true)
      expect(footer.get('.pres-footer-copy').text()).toContain(String(new Date().getFullYear()))
    } finally {
      wrapper.unmount()
    }
  })

  it('observes every reveal-on-scroll section and marks it visible once it intersects', async () => {
    const { wrapper } = await mountPage()
    try {
      const revealEls = wrapper.findAll('.reveal')
      expect(revealEls.length).toBeGreaterThan(0)

      const instances = observerInstances()
      expect(instances).toHaveLength(1)
      const [instance] = instances

      const target = revealEls[0].element
      expect(target.classList.contains('reveal-visible')).toBe(false)

      instance.callback(
        [{ target, isIntersecting: true } as unknown as IntersectionObserverEntry],
        instance as unknown as IntersectionObserver,
      )

      expect(target.classList.contains('reveal-visible')).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})
