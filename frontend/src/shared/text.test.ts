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

  it('merges a run of words matching a multi-word glossary key into one token', () => {
    const glossary = { 'método del plato': { meaning: 'x' } }
    const tokens = tokenizeStoryWords('Usa el método del plato.', glossary)

    expect(tokens.map((t) => t.display)).toEqual(['Usa', 'el', 'método del plato'])
    expect(tokens.map((t) => t.key)).toEqual(['usa', 'el', 'método del plato'])
  })

  it('does not merge words that are not a contiguous glossary phrase', () => {
    const glossary = { 'método del plato': { meaning: 'x' } }
    const tokens = tokenizeStoryWords('El plato tiene un método distinto.', glossary)

    expect(tokens.map((t) => t.key)).toEqual(['el', 'plato', 'tiene', 'un', 'método', 'distinto'])
  })

  it('prefers the longest matching phrase at a given position', () => {
    const glossary = {
      'vitamina a': { meaning: 'x' },
      'vitamina a extra': { meaning: 'y' },
    }
    const tokens = tokenizeStoryWords('Toma vitamina a extra hoy.', glossary)

    expect(tokens.map((t) => t.display)).toEqual(['Toma', 'vitamina a extra', 'hoy'])
  })

  it('ignores an undefined glossary and behaves like single-word tokenizing', () => {
    const tokens = tokenizeStoryWords('método del plato')

    expect(tokens.map((t) => t.key)).toEqual(['método', 'del', 'plato'])
  })
})
