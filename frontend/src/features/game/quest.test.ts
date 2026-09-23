import { describe, expect, it } from 'vitest'
import { advanceQuest, buildQuestSteps, questPrompt, type QuestProgress } from './quest'
import type { GameObject } from '../../shared/types'

const OBJECTS: GameObject[] = [
  { word_id: 'wd-0001', role: 'dialogue', data: { line: 'greeting-formal' } },
  { word_id: 'wd-0023', role: 'dialogue', data: { line: 'affirmation' } },
  { word_id: 'wd-0005', role: 'dialogue', data: { line: 'courtesy-thanks' } },
  { word_id: 'wd-0003', role: 'dialogue', data: { line: 'farewell' } },
  { word_id: 'wd-0009', role: 'noun', data: { concept: 'name' } },
]

describe('buildQuestSteps', () => {
  it('picks out only the three scripted lines, in script order', () => {
    expect(buildQuestSteps(OBJECTS)).toEqual([
      { line: 'greeting-formal', word_id: 'wd-0001' },
      { line: 'affirmation', word_id: 'wd-0023' },
      { line: 'courtesy-thanks', word_id: 'wd-0005' },
    ])
  })

  it('skips missing lines instead of failing', () => {
    const partial = OBJECTS.filter((o) => o.data.line !== 'affirmation')
    expect(buildQuestSteps(partial)).toEqual([
      { line: 'greeting-formal', word_id: 'wd-0001' },
      { line: 'courtesy-thanks', word_id: 'wd-0005' },
    ])
  })

  it('ignores non-dialogue roles even if they carry a line-shaped field', () => {
    expect(buildQuestSteps([{ word_id: 'wd-9999', role: 'noun', data: { line: 'greeting-formal' } }])).toEqual([])
  })
})

describe('advanceQuest', () => {
  const steps = buildQuestSteps(OBJECTS)

  it('advances one stage when the action matches the current expected word', () => {
    const progress: QuestProgress = { stageIndex: 0, completed: false }
    expect(advanceQuest(steps, progress, { action_type: 'SAY', target_word_id: 'wd-0001' })).toEqual({
      stageIndex: 1,
      completed: false,
    })
  })

  it('completes on the final matching step', () => {
    const progress: QuestProgress = { stageIndex: 2, completed: false }
    expect(advanceQuest(steps, progress, { action_type: 'SAY', target_word_id: 'wd-0005' })).toEqual({
      stageIndex: 3,
      completed: true,
    })
  })

  it('returns the same progress reference when the word is wrong', () => {
    const progress: QuestProgress = { stageIndex: 0, completed: false }
    expect(advanceQuest(steps, progress, { action_type: 'SAY', target_word_id: 'wd-0023' })).toBe(progress)
  })

  it('returns the same progress reference once already completed', () => {
    const progress: QuestProgress = { stageIndex: 3, completed: true }
    expect(advanceQuest(steps, progress, { action_type: 'SAY', target_word_id: 'wd-0001' })).toBe(progress)
  })
})

describe('questPrompt', () => {
  const steps = buildQuestSteps(OBJECTS)

  it('returns an empty string when there are no steps', () => {
    expect(questPrompt([], { stageIndex: 0, completed: false })).toBe('')
  })

  it('returns the hint for the current stage', () => {
    expect(questPrompt(steps, { stageIndex: 1, completed: false })).toBe('Answer yes.')
  })

  it('returns a completion message once done', () => {
    expect(questPrompt(steps, { stageIndex: 3, completed: true })).toBe('Quest complete!')
  })
})
