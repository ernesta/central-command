import { describe, expect, it } from 'vitest'
import { textDirection } from './text-direction'

describe('textDirection', () => {
  it('reads the first strong letter', () => {
    expect(textDirection('Hello')).toBe('ltr')
    expect(textDirection('وعليكم السلام')).toBe('rtl')
    expect(textDirection('اردو Urdu')).toBe('rtl')
    expect(textDirection('Urdu اردو')).toBe('ltr')
    expect(textDirection('שלום')).toBe('rtl')
  })
  it('skips markers, digits and punctuation', () => {
    expect(textDirection('## سلام')).toBe('rtl')
    expect(textDirection('- [ ] 12. (سلام)')).toBe('rtl')
    expect(textDirection('| Hello | سلام |')).toBe('ltr')
  })
  it('has none for a line without letters', () => {
    expect(textDirection('')).toBeNull()
    expect(textDirection('---  12')).toBeNull()
  })
})
