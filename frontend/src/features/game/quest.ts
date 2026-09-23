import type { GameObject } from '../../shared/types'
import type { GameAction } from './command'

// Pure and Phaser-free on purpose, same reasoning as sceneItems.ts/
// interaction.ts/command.ts.
//
// Milestone 7 slice: one scripted quest — NPC greets the player, asks a
// yes/no question, player thanks the NPC to close the conversation. Matched
// by the game-content mapping's semantic `data.line` tag (see
// game_approach/content/game-{pair}.json), never a hardcoded word_id — the
// same three-line script works for any origin→target pair whose mapping
// tags these dialogue beats the same way (see LANGUAGE_INTEGRATION.md).
// Lines missing from a given topic's mapping are simply skipped, so a
// shorter/partial mapping degrades to a shorter quest instead of breaking.
const QUEST_LINE_ORDER = ['greeting-formal', 'affirmation', 'courtesy-thanks']

const STEP_HINTS: Record<string, string> = {
  'greeting-formal': 'Say hello.',
  affirmation: 'Answer yes.',
  'courtesy-thanks': 'Say thank you.',
}

export interface QuestStep {
  line: string
  word_id: string
}

export interface QuestProgress {
  stageIndex: number
  completed: boolean
}

export function buildQuestSteps(objects: GameObject[]): QuestStep[] {
  const byLine = new Map(
    objects
      .filter((o) => o.role === 'dialogue' && typeof o.data.line === 'string')
      .map((o) => [o.data.line as string, o.word_id]),
  )
  return QUEST_LINE_ORDER.filter((line) => byLine.has(line)).map((line) => ({
    line,
    word_id: byLine.get(line)!,
  }))
}

// Returns the same `progress` reference when `action` doesn't match the
// current expected step (wrong word, wrong intent, or quest already
// finished) — callers can compare by reference to know whether anything
// changed, instead of this returning a boolean plus an object.
export function advanceQuest(steps: QuestStep[], progress: QuestProgress, action: GameAction): QuestProgress {
  if (progress.completed || progress.stageIndex >= steps.length) return progress
  const expected = steps[progress.stageIndex]
  if (action.action_type !== 'SAY' || action.target_word_id !== expected.word_id) return progress
  const stageIndex = progress.stageIndex + 1
  return { stageIndex, completed: stageIndex >= steps.length }
}

export function questPrompt(steps: QuestStep[], progress: QuestProgress): string {
  if (steps.length === 0) return ''
  if (progress.completed) return 'Quest complete!'
  return STEP_HINTS[steps[progress.stageIndex].line] ?? 'Continue the conversation.'
}
