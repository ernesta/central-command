import { describe, expect, it } from 'vitest'
import { markdownToExcerpt } from './excerpt'

describe('markdownToExcerpt', () => {
  it('is empty for empty or whitespace-only notes', () => {
    expect(markdownToExcerpt('')).toBe('')
    expect(markdownToExcerpt('  \n\n \t')).toBe('')
  })
  it('returns plain text unchanged, collapsing whitespace', () => {
    expect(markdownToExcerpt('Just  a\nplain   note.')).toBe('Just a plain note.')
  })
  it('strips headings, emphasis and inline code', () => {
    expect(markdownToExcerpt('## Method\n\nSome **bold**, *italic*, ~~gone~~ and `code`.')).toBe(
      'Method Some bold, italic, gone and code.'
    )
  })
  it('keeps link text and image alt text, dropping URLs', () => {
    expect(markdownToExcerpt('See [the paper](https://x.org/a) and ![fig 1](img.png).')).toBe(
      'See the paper and fig 1.'
    )
  })
  it('strips list markers, checkboxes and blockquotes', () => {
    expect(markdownToExcerpt('- one\n* two\n1. three\n- [ ] todo\n- [x] done\n> quoted')).toBe(
      'one two three todo done quoted'
    )
  })
  it('keeps the text inside code blocks but not the fences', () => {
    expect(markdownToExcerpt('Before\n```r\nlm(y ~ x)\n```\nAfter')).toBe('Before lm(y ~ x) After')
  })
  it('flattens tables', () => {
    expect(markdownToExcerpt('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('a b 1 2')
  })
  it('drops horizontal rules and inline html', () => {
    expect(markdownToExcerpt('One\n\n---\n\nTwo <br> three')).toBe('One Two three')
  })
  it('does not mangle unicode or words with underscores inside code-free text', () => {
    expect(markdownToExcerpt('Müller’s café — “quotes”')).toBe('Müller’s café — “quotes”')
  })
  it('truncates to 300 characters by default and honours a custom length', () => {
    const long = 'word '.repeat(200)
    expect(markdownToExcerpt(long).length).toBeLessThanOrEqual(300)
    expect(markdownToExcerpt('abcdefghij', 4)).toBe('abcd')
  })
})
