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
