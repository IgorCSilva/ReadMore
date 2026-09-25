import { reactive } from 'vue'

export interface CurrentUser {
  email: string | null
}

const EMAIL_STORAGE_KEY = 'readmore_user_email'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A plain module-level reactive object — same "no store, single shared
// module instance" pattern as currentSelection.ts. Lets any page (Home's
// topbar, the library workspace) read/react to the signed-in email without
// routing it through props.
const state = reactive<CurrentUser>({ email: null })

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

export function setUserEmail(email: string): void {
  state.email = email
  localStorage.setItem(EMAIL_STORAGE_KEY, email)
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
