import { describe, expect, it } from 'vitest'
import { buildIndexRow, firstLineOf } from './index-row'

describe('buildIndexRow', () => {
  it('reads the front matter, the first line and the text', () => {
    const row = buildIndexRow(
      'research',
      'Methods',
      '---\ntitle: Methods\ngroup: Thesis\nsubgroup: Design\npinned: true\ncreated: 2026-09-03\n---\n\n## Participants\n\nSchools were **recruited** through Luminos.\n',
      1_700_000_000_000.7
    )
    expect(row).toMatchObject({
      workspace: 'research',
      id: 'Methods',
      title: 'Methods',
      group: 'Thesis',
      subgroup: 'Design',
      pinned: true,
      created: '2026-09-03',
      edited: 1_700_000_000_000,
      firstLine: 'Participants',
      excerpt: 'Participants Schools were recruited through Luminos.',
      problems: []
    })
    expect(row.contentHash).toHaveLength(40)
  })

  it('is the same for the same text, and indexes a note with no front matter', () => {
    const a = buildIndexRow('research', 'x', 'Just words', 5)
    expect(a).toEqual(buildIndexRow('research', 'x', 'Just words', 5))
    expect(a).toMatchObject({ title: '', group: '', firstLine: 'Just words', problems: [] })
  })

  it('finds the first line with words, skipping blank and mark-only lines', () => {
    expect(firstLineOf('\n\n---\n\n> Quote here\n')).toBe('Quote here')
    expect(firstLineOf('')).toBe('')
  })
})
