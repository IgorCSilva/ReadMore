import { beforeEach, describe, expect, it } from 'vitest'
import { dismiss, getNotifications, hasUnread, markAllRead, notify } from './notifications'

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

describe('notifications', () => {
  beforeEach(() => {
    clearNotifications()
  })

  it('adds a notification with the given type and message, unread by default', () => {
    notify('info', 'hello')

    expect(getNotifications()).toEqual([
      { id: expect.any(Number), type: 'info', message: 'hello', timestamp: expect.any(Number), read: false },
    ])
  })

  it('assigns increasing ids so notifications can be dismissed individually', () => {
    const first = notify('info', 'a')
    const second = notify('info', 'b')

    expect(second).toBeGreaterThan(first)
  })

  it('keeps the most recently added notification first', () => {
    notify('info', 'first')
    notify('info', 'second')

    expect(getNotifications().map((n) => n.message)).toEqual(['second', 'first'])
  })

  it('dismiss removes a notification by id, leaving others untouched', () => {
    const first = notify('success', 'keep')
    const second = notify('success', 'remove')

    dismiss(second)

    expect(getNotifications()).toEqual([
      { id: first, type: 'success', message: 'keep', timestamp: expect.any(Number), read: false },
    ])
  })

  it('reports unread whenever any notification hasn\'t been read yet', () => {
    expect(hasUnread.value).toBe(false)

    notify('info', 'hello')

    expect(hasUnread.value).toBe(true)
  })

  it('markAllRead clears the unread flag for every notification', () => {
    notify('info', 'a')
    notify('info', 'b')

    markAllRead()

    expect(hasUnread.value).toBe(false)
    expect(getNotifications().every((n) => n.read)).toBe(true)
  })
})
