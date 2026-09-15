import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { getNotifications } from './notifications'
import { flushQueuedWrites, getQueuedWrites, hasQueuedAction, performWrite } from './writeQueue'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    incrementShownCount: vi.fn(),
    markWordKnown: vi.fn(),
    showWordAgain: vi.fn(),
  }
})

const QUEUE_KEY = 'readmore:write-queue:v1'

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

function seedQueue(items: unknown[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

describe('writeQueue', () => {
  beforeEach(() => {
    localStorage.clear()
    clearNotifications()
    vi.mocked(api.incrementShownCount).mockReset()
    vi.mocked(api.markWordKnown).mockReset()
    vi.mocked(api.showWordAgain).mockReset()
  })

  describe('performWrite', () => {
    it('succeeds silently: no queue entry, no notification', async () => {
      vi.mocked(api.incrementShownCount).mockResolvedValue(new Response())

      performWrite('increment', 'a@example.com', 'pt-en', 'en-0001')

      await vi.waitFor(() => {
        expect(api.incrementShownCount).toHaveBeenCalled()
      })
      expect(getQueuedWrites()).toEqual([])
      expect(getNotifications()).toEqual([])
    })

    it('queues the write and warns on a network error', async () => {
      vi.mocked(api.markWordKnown).mockRejectedValue(new api.NetworkError(new Error('offline')))

      performWrite('mark-known', 'a@example.com', 'pt-en', 'en-0001')

      await vi.waitFor(() => {
        expect(getQueuedWrites()).toHaveLength(1)
      })
      expect(hasQueuedAction('a@example.com', 'pt-en', 'en-0001', 'mark-known')).toBe(true)
      expect(getNotifications()[0]).toMatchObject({ type: 'warning' })
    })

    it('notifies an error and does not queue on an HTTP-level rejection', async () => {
      vi.mocked(api.showWordAgain).mockRejectedValue(new api.HttpError(404, 'word not assigned'))

      performWrite('show-word', 'a@example.com', 'pt-en', 'en-0001')

      await vi.waitFor(() => {
        expect(getNotifications().length).toBeGreaterThan(0)
      })
      expect(getQueuedWrites()).toEqual([])
      expect(getNotifications()[0]).toMatchObject({ type: 'error' })
    })
  })

  describe('flushQueuedWrites', () => {
    it('replays a queued item and notifies a one-line success summary', async () => {
      seedQueue([
        { id: 1, type: 'mark-known', user: 'a@example.com', lang: 'pt-en', wordId: 'en-0001', queuedAt: 1 },
      ])
      vi.mocked(api.markWordKnown).mockResolvedValue(new Response())

      await flushQueuedWrites()

      expect(api.markWordKnown).toHaveBeenCalledWith('a@example.com', 'pt-en', 'en-0001')
      expect(getQueuedWrites()).toEqual([])
      expect(getNotifications()[0]).toMatchObject({ type: 'success' })
      expect(getNotifications()[0].message).toContain('1')
    })

    it('stops at the first network failure, leaving that item and everything after it queued', async () => {
      seedQueue([
        { id: 1, type: 'increment', user: 'a@example.com', lang: 'pt-en', wordId: 'en-0001', queuedAt: 1 },
        { id: 2, type: 'increment', user: 'a@example.com', lang: 'pt-en', wordId: 'en-0002', queuedAt: 2 },
      ])
      vi.mocked(api.incrementShownCount).mockRejectedValue(new api.NetworkError(new Error('offline')))

      await flushQueuedWrites()

      expect(api.incrementShownCount).toHaveBeenCalledTimes(1)
      expect(getQueuedWrites()).toHaveLength(2)
    })

    it('drops an item that fails with an HTTP error and notifies, without blocking the rest', async () => {
      seedQueue([
        { id: 1, type: 'mark-known', user: 'a@example.com', lang: 'pt-en', wordId: 'en-0001', queuedAt: 1 },
        { id: 2, type: 'increment', user: 'a@example.com', lang: 'pt-en', wordId: 'en-0002', queuedAt: 2 },
      ])
      vi.mocked(api.markWordKnown).mockRejectedValue(new api.HttpError(404, 'word not assigned'))
      vi.mocked(api.incrementShownCount).mockResolvedValue(new Response())

      await flushQueuedWrites()

      expect(getQueuedWrites()).toEqual([])
      expect(getNotifications().some((n) => n.type === 'error')).toBe(true)
      expect(getNotifications().some((n) => n.type === 'success')).toBe(true)
    })

    it('is a no-op when the queue is empty', async () => {
      await flushQueuedWrites()

      expect(getNotifications()).toEqual([])
    })
  })
})
