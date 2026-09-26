import type { Topic } from './types'

// How many words/expressions each numbered "Part N" teaches — shared by
// HomePage (which lists Part 1, Part 2, ...) and the per-part teaching flow
// (which must slice out exactly the same word_ids for a given part number),
// so the two can never disagree about which words belong to which part.
export const PART_SIZE = 5

export function numberedPartsCount(topic: Topic): number {
  return Math.ceil(topic.word_ids.length / PART_SIZE)
}

export function wordIdsForPart(topic: Topic, partNumber: number): string[] {
  const start = (partNumber - 1) * PART_SIZE
  return topic.word_ids.slice(start, start + PART_SIZE)
}

// How many reinforcement (already-learned, spaced-repetition) word_ids each
// numbered Part additionally carries alongside its own new words — shared by
// HomePage (bold new words + italic reinforcement words in the accordion
// preview) and PartFlowPage (folds these into the reading/listen-write
// review pool alongside the part's new words), so both agree on which
// reinforcement word_ids belong to which part.
export const REINFORCEMENT_PER_PART = 2

// `reinforcementWordIds` is the topic's full, curriculum-ordered
// reinforcement list (GetReinforcementWords) — sliced into a fixed-size,
// contiguous chunk per part, same idea as wordIdsForPart above.
export function reinforcementWordIdsForPart(reinforcementWordIds: string[], partNumber: number): string[] {
  const start = (partNumber - 1) * REINFORCEMENT_PER_PART
  return reinforcementWordIds.slice(start, start + REINFORCEMENT_PER_PART)
}

// Reinforcement word_ids left over once every numbered Part has claimed its
// two — these populate the dedicated "Review" Part that HomePage inserts
// right after the numbered parts (only when this list is non-empty).
export function reviewWordIds(topic: Topic, reinforcementWordIds: string[]): string[] {
  const claimed = numberedPartsCount(topic) * REINFORCEMENT_PER_PART
  return reinforcementWordIds.slice(claimed)
}
