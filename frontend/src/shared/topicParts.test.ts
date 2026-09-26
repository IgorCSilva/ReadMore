import { describe, expect, it } from 'vitest'
import {
  numberedPartsCount,
  reinforcementWordIdsForPart,
  reviewWordIds,
  wordIdsForPart,
} from './topicParts'

function topicWithWords(count: number) {
  return { word_ids: Array.from({ length: count }, (_, i) => `w${i + 1}`) } as any
}

describe('numberedPartsCount / wordIdsForPart', () => {
  it('splits a topic\'s word_ids into 5-word parts, the last one possibly shorter', () => {
    const topic = topicWithWords(7)

    expect(numberedPartsCount(topic)).toBe(2)
    expect(wordIdsForPart(topic, 1)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5'])
    expect(wordIdsForPart(topic, 2)).toEqual(['w6', 'w7'])
  })

  it('has zero parts for a topic with no words', () => {
    const topic = topicWithWords(0)

    expect(numberedPartsCount(topic)).toBe(0)
  })
})

describe('reinforcementWordIdsForPart', () => {
  it('gives each part a contiguous 2-word chunk, in order', () => {
    const reinforcementIds = ['r1', 'r2', 'r3', 'r4', 'r5']

    expect(reinforcementWordIdsForPart(reinforcementIds, 1)).toEqual(['r1', 'r2'])
    expect(reinforcementWordIdsForPart(reinforcementIds, 2)).toEqual(['r3', 'r4'])
  })

  it('returns fewer than 2 (or none) once the list runs out', () => {
    const reinforcementIds = ['r1', 'r2', 'r3']

    expect(reinforcementWordIdsForPart(reinforcementIds, 2)).toEqual(['r3'])
    expect(reinforcementWordIdsForPart(reinforcementIds, 3)).toEqual([])
  })
})

describe('reviewWordIds', () => {
  it('is whatever is left once every numbered part has claimed its 2', () => {
    const topic = topicWithWords(7) // 2 numbered parts
    const reinforcementIds = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']

    expect(reviewWordIds(topic, reinforcementIds)).toEqual(['r5', 'r6', 'r7'])
  })

  it('is empty when there are no reinforcement words to spare', () => {
    const topic = topicWithWords(7)
    const reinforcementIds = ['r1', 'r2', 'r3', 'r4']

    expect(reviewWordIds(topic, reinforcementIds)).toEqual([])
  })

  it('is the entire reinforcement list for a topic with no numbered parts', () => {
    const topic = topicWithWords(0)
    const reinforcementIds = ['r1', 'r2']

    expect(reviewWordIds(topic, reinforcementIds)).toEqual(['r1', 'r2'])
  })
})
