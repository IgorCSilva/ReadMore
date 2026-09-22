import { describe, expect, it } from 'vitest'
import { distance, isWithinInteractRange } from './interaction'

describe('distance', () => {
  it('computes straight-line distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('is zero for the same point', () => {
    expect(distance({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0)
  })
})

describe('isWithinInteractRange', () => {
  it('is true when the distance is under the radius', () => {
    expect(isWithinInteractRange({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)).toBe(true)
  })

  it('is true when the distance exactly equals the radius', () => {
    expect(isWithinInteractRange({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true)
  })

  it('is false when the distance exceeds the radius', () => {
    expect(isWithinInteractRange({ x: 0, y: 0 }, { x: 3, y: 4 }, 4)).toBe(false)
  })
})
