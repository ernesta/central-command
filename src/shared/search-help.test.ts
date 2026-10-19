import { describe, expect, it } from 'vitest'
import { allSummaries, MODIFIER_HELP, summarise } from './search-help'
import { MODIFIER_NAMES } from './search-query'

describe('search help table', () => {
  it('describes every modifier the tokenizer knows, in its order, and nothing else', () => {
    expect(Object.keys(MODIFIER_HELP).sort()).toEqual([...MODIFIER_NAMES].sort())
    expect(allSummaries().map((s) => s.name)).toEqual([...MODIFIER_NAMES])
  })

  it('gives a fixed set as chips, with spaces quoted, and no line', () => {
    expect(summarise('in').chips.map((c) => c.label)).toContain('meetings')
    expect(summarise('workspace').chips.map((c) => c.label)).toEqual(['research', 'work', 'life'])
    const status = summarise('status')
    expect(status.chips.find((c) => c.label === 'to do')?.insert).toBe('"to do"')
    expect(status.line).toBeNull()
    expect(summarise('priority').chips.map((c) => c.label)).toEqual(['P1', 'P2', 'P3'])
    expect(summarise('has').chips.length).toBeGreaterThan(0)
  })

  it('gives a free-form value one line of forms and no chips', () => {
    const before = summarise('before')
    expect(before.chips).toEqual([])
    expect(before.line).toBe('YYYY-MM-DD, YYYY-MM, YYYY, today, yesterday')
    expect(summarise('tag').line).not.toBeNull()
  })

  it('offers people for with: and by: only', () => {
    expect(summarise('with').people).toBe(true)
    expect(summarise('by').people).toBe(true)
    expect(summarise('tag').people).toBe(false)
  })
})
