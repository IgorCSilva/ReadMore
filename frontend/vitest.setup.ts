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
