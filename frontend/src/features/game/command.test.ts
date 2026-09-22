import { describe, expect, it } from 'vitest'
import { parseCommand, tokenize, type CommandVocabularyEntry } from './command'

const VOCAB: CommandVocabularyEntry[] = [
  { word_id: 'wd-0001', text: 'hola' },
  { word_id: 'wd-0009', text: 'nombre' },
]

describe('tokenize', () => {
  it('splits on whitespace and trims', () => {
    expect(tokenize('  SAY   hola  ')).toEqual(['SAY', 'hola'])
  })

  it('returns an empty array for blank input', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('parseCommand', () => {
  it('recognizes SAY followed by a known word, case-insensitively', () => {
    expect(parseCommand('say HOLA', VOCAB)).toEqual({
      ok: true,
      action: { action_type: 'SAY', target_word_id: 'wd-0001' },
    })
  })

  it('matches a multi-word target by joining the remaining tokens', () => {
    const vocab: CommandVocabularyEntry[] = [{ word_id: 'wd-0072', text: 'de nada' }]
    expect(parseCommand('SAY de nada', vocab)).toEqual({
      ok: true,
      action: { action_type: 'SAY', target_word_id: 'wd-0072' },
    })
  })

  it('rejects empty input', () => {
    expect(parseCommand('   ', VOCAB)).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects an unrecognized intent', () => {
    expect(parseCommand('OPEN hola', VOCAB)).toEqual({ ok: false, reason: 'unknown_intent' })
  })

  it('rejects a target not in the active vocabulary', () => {
    expect(parseCommand('SAY adios', VOCAB)).toEqual({ ok: false, reason: 'unknown_target' })
  })
})
