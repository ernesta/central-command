import { describe, expect, it } from 'vitest'
import { convertMath, fixEscapedLinks, mathToText, removeEmptyNotes } from './library-tidy'

describe('removeEmptyNotes', () => {
  it('drops an empty last section', () => {
    expect(removeEmptyNotes('---\na: 1\n---\n\n## Summary\n\nText\n\n## Notes\n')).toBe(
      '---\na: 1\n---\n\n## Summary\n\nText\n'
    )
  })
  it('drops an empty section in the middle and keeps the next heading', () => {
    expect(removeEmptyNotes('## Summary\n\nT\n\n## Notes\n\n## Files\n\nF\n')).toBe(
      '## Summary\n\nT\n\n## Files\n\nF\n'
    )
  })
  it('keeps a section with text, including under a subheading', () => {
    const t = '## Notes\n\n### Overview\n\nHi\n'
    expect(removeEmptyNotes(t)).toBe(t)
  })
  it('leaves a note with no Notes heading alone', () => {
    expect(removeEmptyNotes('## Summary\n\nT\n')).toBe('## Summary\n\nT\n')
  })
})

describe('fixEscapedLinks', () => {
  it('handles the three shapes', () => {
    expect(fixEscapedLinks('\\[A]\\(<https://a.io>)')).toBe('[A](https://a.io)')
    expect(fixEscapedLinks('\\[W]\\(https\\://x\\.com/w)')).toBe('[W](https://x.com/w)')
    expect(fixEscapedLinks('\\[M]\\([https://m.io/l](https://m.io/l/))')).toBe(
      '[M](https://m.io/l/)'
    )
  })
  it('leaves good links alone', () => {
    expect(fixEscapedLinks('[A](https://a.io)')).toBe('[A](https://a.io)')
  })
})

describe('convertMath', () => {
  it('converts arrows', () => {
    expect(convertMath('a $\\rightarrow$ b').text).toBe('a → b')
    expect(convertMath('$Print \\rightarrow Sound$').text).toBe('Print → Sound')
  })
  it('writes statistics APA-style with a leading zero', () => {
    expect(mathToText('d=.44')).toBe('*d* = 0.44')
    expect(mathToText('d = 0.288')).toBe('*d* = 0.288')
    expect(mathToText('r = .20 - .30')).toBe('*r* = 0.20–0.30')
    expect(mathToText('ES = 0.29')).toBe('ES = 0.29')
    expect(mathToText('0.059')).toBe('0.059')
    expect(mathToText('d = -.5')).toBe('*d* = −0.5')
  })
  it('leaves prose dollars and code alone', () => {
    const t = 'to $150k, but not all $150k can be spent and `$d=.1$`'
    expect(convertMath(t).text).toBe(t)
  })
  it('reports shapes it does not know', () => {
    const r = convertMath('$\\frac{a}{b}$')
    expect(r.text).toBe('$\\frac{a}{b}$')
    expect(r.left).toEqual(['$\\frac{a}{b}$'])
  })
})
