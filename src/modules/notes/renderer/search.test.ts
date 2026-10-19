import { describe, expect, it } from 'vitest'
import type { NoteIndexRow } from '../shared/types'
import { noteHits } from './search'
import { plainRequest, searchRequest } from '@shared/search-query'

const note = (over: Partial<NoteIndexRow>): NoteIndexRow => ({
  workspace: 'research',
  id: 'Methods',
  uid: '',
  title: 'Methods',
  group: 'Thesis',
  subgroup: '',
  pinned: false,
  edited: new Date(2026, 8, 25, 12).getTime(),
  firstLine: '',
  excerpt: '',
  problems: [],
  contentHash: 'h',
  ...over
})

describe('noteHits', () => {
  const rows = [
    note({ id: 'Methods', title: 'Methods', excerpt: 'Schools were recruited through Luminos.' }),
    note({ id: 'Other', title: 'Other', group: '', excerpt: 'Nothing here.' })
  ]

  it('finds a note by its title and describes it by group and date', () => {
    expect(noteHits(rows, plainRequest('methods'))).toEqual([
      {
        key: 'Methods',
        title: 'Methods',
        detail: 'Thesis · Sep 25',
        route: '/research/notes/n/Methods'
      }
    ])
  })

  it('finds a note by its text and shows the part that matched', () => {
    const [hit] = noteHits(rows, plainRequest('luminos'))
    expect(hit.title).toBe('Methods')
    expect(hit.detail).toContain('Luminos')
  })

  it('finds nothing when a word is missing, and everything for an empty query', () => {
    expect(noteHits(rows, plainRequest('luminos zebra'))).toEqual([])
    expect(noteHits(rows, plainRequest(''))).toHaveLength(2)
  })

  it('shows at most six', () => {
    const many = Array.from({ length: 10 }, (_, i) => note({ id: `n${i}`, title: `Note ${i}` }))
    expect(noteHits(many, plainRequest('note'))).toHaveLength(6)
  })
})

describe('noteHits with modifiers', () => {
  const today = '2026-10-19'
  const edited = (y: number, m: number, d: number): number => new Date(y, m - 1, d, 12).getTime()
  const rows = [
    note({
      id: 'A',
      title: 'A',
      excerpt: 'Met Chris Cummiskey about Luminos.',
      edited: edited(2026, 5, 3)
    }),
    note({ id: 'B', title: 'B', excerpt: 'Alone.', edited: edited(2026, 10, 18) }),
    note({ id: 'C', title: 'C', excerpt: 'Chris Cummiskey again.', edited: edited(2025, 12, 31) })
  ]
  const run = (query: string): string[] =>
    noteHits(rows, searchRequest(query, today), 40).map((h) => h.key)

  it('with: a person named in the note (full name)', () => {
    expect(run('with:"chris cummiskey"').sort()).toEqual(['A', 'C'])
    expect(run('-with:"chris cummiskey"')).toEqual(['B'])
    expect(run('luminos with:"chris cummiskey"')).toEqual(['A'])
  })

  it('dates are the day the note was last edited', () => {
    expect(run('after:2026-05')).toEqual(['B'])
    expect(run('before:2026')).toEqual(['C'])
    expect(run('on:2026-05-03')).toEqual(['A'])
    expect(run('during:"this month"')).toEqual(['B'])
    expect(run('-during:2026')).toEqual(['C'])
  })

  it('finds a quoted phrase only as written, across the title and text', () => {
    expect(run('"chris cummiskey again"')).toEqual(['C'])
    expect(run('"cummiskey chris"')).toEqual([])
  })
})
