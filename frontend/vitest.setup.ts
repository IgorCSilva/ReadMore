import { vi } from 'vitest'

// App.vue's onMounted flow (ported unchanged from viewer.html) calls
// window.prompt() synchronously in a loop until it gets a valid-looking
// email, to identify the user. jsdom doesn't implement window.prompt, and
// without a stub the loop would spin forever waiting for a real answer —
// stub it to return a valid email immediately so mounting the component in
// tests never hangs.
vi.stubGlobal(
  'prompt',
  vi.fn(() => 'test@example.com'),
)

// jsdom doesn't implement window.matchMedia at all — Typing.vue reads
// prefers-reduced-motion on mount, which would otherwise throw
// "matchMedia is not a function" for every test that mounts it. Reports
// "no preference" (matches: false) unconditionally; nothing today needs a
// test that simulates the reduced-motion preference actually being on.
vi.stubGlobal(
  'matchMedia',
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
)

// jsdom doesn't implement IntersectionObserver — PresentationPage.vue uses
// it to reveal sections on scroll. A minimal stub that just records
// observe/unobserve calls is enough; nothing here needs real viewport
// intersection math, and tests that need to simulate a reveal can grab the
// most recent instance off `(window as any).__intersectionObservers`.
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds: ReadonlyArray<number> = []

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    ;((window as unknown) as { __intersectionObservers: MockIntersectionObserver[] }).__intersectionObservers ??= []
    ;((window as unknown) as { __intersectionObservers: MockIntersectionObserver[] }).__intersectionObservers.push(this)
  }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
