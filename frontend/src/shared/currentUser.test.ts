import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureUserEmail,
  getCurrentUser,
  isValidEmail,
  logoutUser,
  promptForEmail,
  setUserEmail,
} from './currentUser'

const STORAGE_KEY = 'readmore_user_email'

describe('currentUser', () => {
  beforeEach(() => {
    localStorage.clear()
    logoutUser()
    // window.prompt is already a vi.fn() (stubbed globally in
    // vitest.setup.ts, for every test file that mounts a page calling
    // ensureUserEmail) — vi.spyOn-ing an already-mocked function here
    // double-wraps it and vi.restoreAllMocks() doesn't clear the outer
    // wrapper's call history afterwards, so counts leak between tests.
    // Reconfiguring the existing mock directly avoids that entirely.
    vi.mocked(window.prompt).mockClear()
  })

  afterEach(() => {
    vi.mocked(window.prompt).mockReset()
  })

  describe('isValidEmail', () => {
    it('accepts a plausible email address', () => {
      expect(isValidEmail('a@b.com')).toBe(true)
    })

    it('rejects strings without an @ or a dot in the domain', () => {
      expect(isValidEmail('not-an-email')).toBe(false)
      expect(isValidEmail('a@b')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })
  })

  describe('setUserEmail / getCurrentUser', () => {
    it('updates the reactive state and persists to localStorage', () => {
      setUserEmail('a@b.com')

      expect(getCurrentUser().email).toBe('a@b.com')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('a@b.com')
    })
  })

  describe('logoutUser', () => {
    it('clears the reactive state and localStorage', () => {
      setUserEmail('a@b.com')

      logoutUser()

      expect(getCurrentUser().email).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })

  describe('ensureUserEmail', () => {
    it('returns the already-set state email without touching localStorage or prompting', () => {
      setUserEmail('cached@example.com')

      expect(ensureUserEmail()).toBe('cached@example.com')
      expect(window.prompt).not.toHaveBeenCalled()
    })

    it('adopts a valid stored email without prompting', () => {
      localStorage.setItem(STORAGE_KEY, 'stored@example.com')

      expect(ensureUserEmail()).toBe('stored@example.com')
      expect(window.prompt).not.toHaveBeenCalled()
      expect(getCurrentUser().email).toBe('stored@example.com')
    })

    it('falls back to prompting when nothing valid is stored, and saves the answer', () => {
      vi.mocked(window.prompt).mockReturnValue('prompted@example.com')

      expect(ensureUserEmail()).toBe('prompted@example.com')
      expect(getCurrentUser().email).toBe('prompted@example.com')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('prompted@example.com')
    })
  })

  describe('promptForEmail', () => {
    it('keeps asking until a valid-looking email is entered', () => {
      const responses = ['not an email', 'still not one', 'valid@example.com']
      vi.mocked(window.prompt).mockImplementation(() => responses.shift() ?? null)

      expect(promptForEmail('Enter your email')).toBe('valid@example.com')
      expect(window.prompt).toHaveBeenCalledTimes(3)
    })

    it('keeps asking through a cancelled (null) prompt', () => {
      const responses: Array<string | null> = [null, 'valid@example.com']
      vi.mocked(window.prompt).mockImplementation(() => responses.shift() ?? null)

      expect(promptForEmail('Enter your email')).toBe('valid@example.com')
      expect(window.prompt).toHaveBeenCalledTimes(2)
    })
  })
})
