import { describe, expect, it } from 'vitest'
import { wordCount, wordCountLabel } from './words'

describe('wordCount', () => {
  it('counts words, not Markdown marks', () => {
    expect(
      wordCount('## Participants\n\nSchools were **recruited** through [Luminos](https://x.org).\n')
    ).toBe(6)
    expect(wordCount('- [x] one\n- [ ] two\n')).toBe(2)
  })

  it('is zero for an empty or mark-only note', () => {
    expect(wordCount('')).toBe(0)
    expect(wordCount('\n\n---\n')).toBe(0)
  })

  it('counts a long note in full, not just its start', () => {
    expect(wordCount('word '.repeat(2000))).toBe(2000)
  })
})

describe('wordCountLabel', () => {
  it('says word or words', () => {
    expect(wordCountLabel(1)).toBe('1 word')
    expect(wordCountLabel(412)).toBe('412 words')
    expect(wordCountLabel(1234)).toBe('1,234 words')
  })
})
