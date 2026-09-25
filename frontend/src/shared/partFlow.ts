import type { Word } from './types'

export type FlowStep =
  | { kind: 'word'; pageNumber: 1 | 2 | 3; word: Word }
  | { kind: 'reading' }
  | { kind: 'listen-write' }

// Randomly interleaves each word's 3 pages while keeping a given word's own
// pages in order (Page 1 before Page 2 before Page 3) — at every step, pick
// uniformly among the words that still have a page left, matching "The mix
// must be made in a random way" while "the pages of a specific word must be
// in order". Reading/Listen-and-write always come last, once every word's
// pages are done.
export function buildPartFlowSequence(words: Word[]): FlowStep[] {
  const cursors = words.map(() => 0)
  const seq: FlowStep[] = []
  while (seq.length < words.length * 3) {
    const candidates = words.map((_, i) => i).filter((i) => cursors[i] < 3)
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    seq.push({ kind: 'word', pageNumber: (cursors[pick] + 1) as 1 | 2 | 3, word: words[pick] })
    cursors[pick]++
  }
  seq.push({ kind: 'reading' })
  seq.push({ kind: 'listen-write' })
  return seq
}
