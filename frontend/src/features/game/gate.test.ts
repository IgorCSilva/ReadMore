import { describe, expect, it } from 'vitest'
import { buildGateState, tryOpenGate, type GateState } from './gate'
import type { GameObject } from '../../shared/types'

const OBJECTS: GameObject[] = [
  { word_id: 'wd-0001', role: 'dialogue', data: { line: 'greeting-formal' } },
  { word_id: 'wd-0079', role: 'noun', data: { concept: 'night' } },
  { word_id: 'wd-0080', role: 'noun', data: { concept: 'day' } },
]

describe('buildGateState', () => {
  it('finds the noun tagged with the gate concept and starts locked', () => {
    expect(buildGateState(OBJECTS)).toEqual({ wordId: 'wd-0079', open: false })
  })

  it('returns a null wordId when the topic has no matching concept', () => {
    const withoutNight = OBJECTS.filter((o) => o.data.concept !== 'night')
    expect(buildGateState(withoutNight)).toEqual({ wordId: null, open: false })
  })

  it('ignores a matching concept on a non-noun role', () => {
    expect(buildGateState([{ word_id: 'wd-9999', role: 'dialogue', data: { concept: 'night' } }])).toEqual({
      wordId: null,
      open: false,
    })
  })
})

describe('tryOpenGate', () => {
  const locked: GateState = { wordId: 'wd-0079', open: false }

  it('opens when the correct word is said while in range', () => {
    expect(tryOpenGate(locked, { action_type: 'SAY', target_word_id: 'wd-0079' }, true)).toEqual({
      wordId: 'wd-0079',
      open: true,
    })
  })

  it('returns the same state reference when out of range', () => {
    expect(tryOpenGate(locked, { action_type: 'SAY', target_word_id: 'wd-0079' }, false)).toBe(locked)
  })

  it('returns the same state reference for the wrong word', () => {
    expect(tryOpenGate(locked, { action_type: 'SAY', target_word_id: 'wd-0080' }, true)).toBe(locked)
  })

  it('returns the same state reference once already open', () => {
    const open: GateState = { wordId: 'wd-0079', open: true }
    expect(tryOpenGate(open, { action_type: 'SAY', target_word_id: 'wd-0079' }, true)).toBe(open)
  })

  it('returns the same state reference when the topic has no gate word', () => {
    const noGate: GateState = { wordId: null, open: false }
    expect(tryOpenGate(noGate, { action_type: 'SAY', target_word_id: 'wd-0079' }, true)).toBe(noGate)
  })
})
