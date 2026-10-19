import { describe, expect, it } from 'vitest'
import { parseMarkdownLine } from './markdownLine'

describe('parseMarkdownLine', () => {
  it('treats an empty line as blank', () => {
    expect(parseMarkdownLine('')).toEqual({ kind: 'blank', html: '', plainText: '' })
  })

  it('treats a table separator row as blank', () => {
    expect(parseMarkdownLine('|---|---|')).toEqual({ kind: 'blank', html: '', plainText: '' })
  })

  it('strips a level-1 heading marker, keeping the text', () => {
    const result = parseMarkdownLine('# Nutrición — Tema 1')
    expect(result.kind).toBe('h1')
    expect(result.html).toBe('Nutrición — Tema 1')
    expect(result.plainText).toBe('Nutrición — Tema 1')
  })

  it('strips level-2 and level-3 heading markers', () => {
    expect(parseMarkdownLine('## Carbohidratos').kind).toBe('h2')
    expect(parseMarkdownLine('### Comida de Ejemplo').kind).toBe('h3')
  })

  it('strips a bullet marker and prefixes a visible bullet', () => {
    const result = parseMarkdownLine('- Carbohidratos')
    expect(result.kind).toBe('li')
    expect(result.html).toBe('• Carbohidratos')
    expect(result.plainText).toBe('Carbohidratos')
  })

  it('converts **bold** to <strong> for display but keeps plain text spoken', () => {
    const result = parseMarkdownLine('Las llamamos **macronutrientes**. Son:')
    expect(result.kind).toBe('p')
    expect(result.html).toBe('Las llamamos <strong>macronutrientes</strong>. Son:')
    expect(result.plainText).toBe('Las llamamos macronutrientes. Son:')
  })

  it('turns a table data row into readable cells instead of literal pipes', () => {
    const result = parseMarkdownLine('| Proteína | Pollo a la parrilla |')
    expect(result.kind).toBe('p')
    expect(result.plainText).toBe('Proteína — Pollo a la parrilla')
  })

  it('escapes HTML-sensitive characters before formatting', () => {
    const result = parseMarkdownLine('5 < 10 & 10 > 5')
    expect(result.html).toBe('5 &lt; 10 &amp; 10 &gt; 5')
  })

  it('leaves a plain paragraph line untouched aside from trimming', () => {
    const result = parseMarkdownLine('Ingredientes:')
    expect(result).toEqual({ kind: 'p', html: 'Ingredientes:', plainText: 'Ingredientes:' })
  })
})
