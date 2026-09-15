import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dismiss, getNotifications, notify } from './notifications'

function clearNotifications() {
  const list = getNotifications()
  list.splice(0, list.length)
}

describe('notifications', () => {
  beforeEach(() => {
    clearNotifications()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds a notification with the given type and message', () => {
    notify('info', 'hello')

    expect(getNotifications()).toEqual([{ id: expect.any(Number), type: 'info', message: 'hello' }])
  })

  it('assigns increasing ids so notifications can be dismissed individually', () => {
    const first = notify('info', 'a')
    const second = notify('info', 'b')

    expect(second).toBeGreaterThan(first)
  })

  it('dismiss removes a notification by id, leaving others untouched', () => {
    const first = notify('success', 'keep')
    const second = notify('success', 'remove')

    dismiss(second)

    expect(getNotifications()).toEqual([{ id: first, type: 'success', message: 'keep' }])
  })

  it('auto-dismisses info/success/warning after their timeout, but never error', () => {
    vi.useFakeTimers()

    notify('info', 'a')
    notify('success', 'b')
    notify('warning', 'c')
    notify('error', 'd')

    vi.advanceTimersByTime(4000)
    expect(getNotifications().map((n) => n.type)).toEqual(['warning', 'error'])

    vi.advanceTimersByTime(4000)
    expect(getNotifications().map((n) => n.type)).toEqual(['error'])
  })
})
