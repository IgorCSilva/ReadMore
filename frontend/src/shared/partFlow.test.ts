import { describe, expect, it } from 'vitest'
import { buildPartFlowSequence } from './partFlow'

function makeWords(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    word_id: `w${i + 1}`,
    original: `word${i + 1}`,
    filename: '',
    sentence: '',
    cue: '',
    gender_id: '',
  }))
}

describe('buildPartFlowSequence', () => {
  it('ends with reading then listen-write, sized words*3 + 2', () => {
    const words = makeWords(5)
    const seq = buildPartFlowSequence(words)

    expect(seq).toHaveLength(17)
    expect(seq.at(-2)).toEqual({ kind: 'reading' })
    expect(seq.at(-1)).toEqual({ kind: 'listen-write' })
  })

  it('keeps each word\'s own pages in order (1, 2, 3), however interleaved with others', () => {
    // Run many times since the interleaving is randomized — the per-word
    // order constraint must hold regardless of which shuffle came out.
    for (let run = 0; run < 50; run++) {
      const words = makeWords(5)
      const seq = buildPartFlowSequence(words)

      for (const word of words) {
        const pageNumbers = seq.flatMap((step) =>
          step.kind === 'word' && step.word.word_id === word.word_id ? [step.pageNumber] : []
        )
        expect(pageNumbers).toEqual([1, 2, 3])
      }
    }
  })

  it('handles a partial (non-5) word count, e.g. the last chunk of a topic', () => {
    const words = makeWords(2)
    const seq = buildPartFlowSequence(words)

    expect(seq).toHaveLength(8)
    expect(seq.filter((s) => s.kind === 'word')).toHaveLength(6)
  })
})
