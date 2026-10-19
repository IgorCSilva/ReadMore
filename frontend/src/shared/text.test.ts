import { describe, expect, it } from 'vitest'
import { tokenizeStoryWords } from './text'

describe('tokenizeStoryWords', () => {
  it('splits on whitespace and strips outer punctuation', () => {
    const tokens = tokenizeStoryWords('When rain starts to pour, there is nothing more sweet,')

    expect(tokens.map((t) => t.display)).toEqual([
      'When', 'rain', 'starts', 'to', 'pour', 'there', 'is', 'nothing', 'more', 'sweet',
    ])
    expect(tokens.map((t) => t.key)).toEqual([
      'when', 'rain', 'starts', 'to', 'pour', 'there', 'is', 'nothing', 'more', 'sweet',
    ])
  })

  it('keeps internal apostrophes and hyphens, only stripping outer punctuation', () => {
    const tokens = tokenizeStoryWords('They weren’t cold- I didn’t mind.')

    expect(tokens.map((t) => t.display)).toEqual(['They', 'weren’t', 'cold', 'I', 'didn’t', 'mind'])
  })

  it('folds curly apostrophes to straight ones only in the lookup key', () => {
    const [token] = tokenizeStoryWords('weren’t')

    expect(token.display).toBe('weren’t')
    expect(token.key).toBe("weren't")
  })

  it('keeps a hyphenated compound word intact', () => {
    const tokens = tokenizeStoryWords('splish-sploshing with wet muddy feet.')

    expect(tokens[0]).toEqual({ display: 'splish-sploshing', key: 'splish-sploshing' })
  })

  it('returns an empty list for a blank line', () => {
    expect(tokenizeStoryWords('')).toEqual([])
  })
})
