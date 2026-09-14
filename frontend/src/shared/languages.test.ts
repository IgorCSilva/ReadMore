import { describe, expect, it } from 'vitest'
import { formatLanguagePairLabel } from './languages'

describe('formatLanguagePairLabel', () => {
  it('formats a known pair as readable names', () => {
    expect(formatLanguagePairLabel('pt-en')).toBe('Portuguese → English')
    expect(formatLanguagePairLabel('pt-es')).toBe('Portuguese → Spanish')
  })

  it('falls back to the raw code for an unmapped language', () => {
    expect(formatLanguagePairLabel('fr-de')).toBe('fr → de')
  })
})
