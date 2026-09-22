import type { GameAreaResponse, WordsResponse } from '../../shared/types'

export interface SceneItem {
  word_id: string
  role: string
  text: string
}

// Pure and Phaser-free on purpose (same reasoning GAME_ARCHITECTURE.md gives
// for the future command parser: testable without a canvas). word_id here is
// the catalog root id both GameObject and Word already share — see
// LANGUAGE_INTEGRATION.md — so this is a plain lookup, no translation layer.
export function buildSceneItems(area: GameAreaResponse, words: WordsResponse): SceneItem[] {
  const byId = new Map(words.words.map((w) => [w.word_id, w]))
  return area.objects.map((o) => ({
    word_id: o.word_id,
    role: o.role,
    text: byId.get(o.word_id)?.original ?? o.word_id,
  }))
}
