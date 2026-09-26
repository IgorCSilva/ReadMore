import { reactive } from 'vue'

export interface CurrentUser {
  email: string | null
}

const EMAIL_STORAGE_KEY = 'readmore_user_email'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readStoredEmail(): string | null {
  const stored = localStorage.getItem(EMAIL_STORAGE_KEY)
  return stored && EMAIL_RE.test(stored) ? stored : null
}

// A plain module-level reactive object — same "no store, single shared
// module instance" pattern as currentSelection.ts. Lets any page (Home's
// topbar, the library workspace) read/react to the signed-in email without
// routing it through props. Seeded from localStorage at module load so a
// fresh page load (e.g. landing straight on /signin) already reflects a
// previously signed-in email, and the router guard can check it before any
// page has had a chance to call ensureUserEmail() itself.
const state = reactive<CurrentUser>({ email: readStoredEmail() })

export function getCurrentUser(): CurrentUser {
  return state
}

export function promptForEmail(message: string): string {
  let email: string | null = null
  while (!email || !EMAIL_RE.test(email)) {
    email = window.prompt(message)
    if (email === null) continue // keep asking, there's no usable default
    email = email.trim()
  }
  return email
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

export function setUserEmail(email: string): void {
  state.email = email
  localStorage.setItem(EMAIL_STORAGE_KEY, email)
}

// Used by SignInPage.vue's explicit Logout button, and implicitly whenever
// signing in with a different email than the one currently stored (setting
// the new one already overwrites state/localStorage — no separate clear
// step needed for that case).
export function logoutUser(): void {
  state.email = null
  localStorage.removeItem(EMAIL_STORAGE_KEY)
}

// Resolves the signed-in email for this browser session — from localStorage
// if a valid one is stored, otherwise blocks on a prompt. Idempotent once
// state.email is set, so every page can call this on mount without risking
// a second prompt.
export function ensureUserEmail(): string {
  if (state.email) return state.email
  const stored = localStorage.getItem(EMAIL_STORAGE_KEY)
  const email = stored && EMAIL_RE.test(stored) ? stored : promptForEmail('Enter your email to load your word list:')
  setUserEmail(email)
  return email
}
