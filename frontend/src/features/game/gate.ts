import type { GameObject } from '../../shared/types'
import type { GameAction } from './command'

// Pure and Phaser-free on purpose, same reasoning as quest.ts/command.ts/
// sceneItems.ts/interaction.ts.
//
// Milestone 8 slice: one locked gate in the scene that opens only when the
// player SAYs a specific target-language word while standing near it — the
// only way to open it (per GAME_DESIGN.md principle 4, "language controls
// access, not artificial levels"). Like quest.ts's conversation script, the
// required word is found by a semantic `data.concept` tag on a `noun`-role
// GameObject, never a hardcoded word_id, so any origin→target pair whose
// mapping tags a word with this concept gets a working gate for free. A
// topic whose mapping has no word for this concept simply has no working
// gate (`wordId: null`) rather than breaking.
const GATE_CONCEPT = 'night'

export interface GateState {
  wordId: string | null
  open: boolean
}

export function buildGateState(objects: GameObject[]): GateState {
  const match = objects.find((o) => o.role === 'noun' && o.data.concept === GATE_CONCEPT)
  return { wordId: match ? match.word_id : null, open: false }
}

// Returns the same `state` reference when nothing changes (already open, no
// word assigned, player out of range, or the wrong word/intent) — same
// reference-equality convention as quest.ts's advanceQuest, so callers can
// tell "did this open the gate" without a separate boolean.
export function tryOpenGate(state: GateState, action: GameAction, inRange: boolean): GateState {
  if (state.open || !state.wordId || !inRange) return state
  if (action.action_type !== 'SAY' || action.target_word_id !== state.wordId) return state
  return { ...state, open: true }
}
