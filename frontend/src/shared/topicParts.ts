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
