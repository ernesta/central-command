import { describe, expect, it } from 'vitest'
import { planFileName, planOutline, planYearFromFileName } from './plan'

describe('plan file names', () => {
  it('round-trips the academic year', () => {
    expect(planFileName(2026)).toBe('Training plan 2026-27.md')
    expect(planYearFromFileName('Training plan 2026-27.md')).toBe(2026)
    expect(planYearFromFileName('Training plan 2026-27.md.bak')).toBeNull()
    expect(planYearFromFileName('2026-09-24 Seminar.md')).toBeNull()
  })
})

describe('planOutline', () => {
  it('lists level 2 and 3 headings as plain text', () => {
    const md = [
      '# Title',
      '## Priority 1',
      '### 1. Literature and the *Research* Landscape',
      '### 2. [Bayes](https://example.org) `models`',
      '#### too deep',
      'not a heading'
    ].join('\n')
    expect(planOutline(md)).toEqual([
      { level: 2, text: 'Priority 1' },
      { level: 3, text: '1. Literature and the Research Landscape' },
      { level: 3, text: '2. Bayes models' }
    ])
  })

  it('skips headings inside code fences', () => {
    expect(planOutline('```\n## not a heading\n```\n## Real')).toEqual([{ level: 2, text: 'Real' }])
  })
})
