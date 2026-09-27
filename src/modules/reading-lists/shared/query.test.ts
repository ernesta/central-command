import { describe, expect, it } from 'vitest'
import { displayTitle, queryLists } from './query'
import type { ReadingListIndexRow } from './types'

function row(over: Partial<ReadingListIndexRow> = {}): ReadingListIndexRow {
  return {
    workspace: 'research',
    id: over.title ?? 'A',
    title: '',
    edited: 0,
    sectionCount: 0,
    entryCount: 0,
    excerpt: '',
    contentHash: '',
    ...over
  }
}

describe('displayTitle', () => {
  it('is "Untitled list" without a title', () => {
    expect(displayTitle(row())).toBe('Untitled list')
    expect(displayTitle(row({ title: 'LOI' }))).toBe('LOI')
  })
})

describe('queryLists', () => {
  it('matches the title or the excerpt, case- and accent-insensitively, every word required', () => {
    const rows = [
      row({ id: '1', title: 'Language of Instruction', edited: 1 }),
      row({ id: '2', title: 'Other', excerpt: 'mentions kim2020 somewhere', edited: 2 }),
      row({ id: '3', title: 'Unrelated', edited: 3 })
    ]
    expect(queryLists(rows, 'language').map((r) => r.id)).toEqual(['1'])
    expect(queryLists(rows, 'kim2020').map((r) => r.id)).toEqual(['2'])
    expect(queryLists(rows, '').map((r) => r.id)).toEqual(['3', '2', '1']) // most recent first
  })
})
