import { describe, expect, it } from 'vitest'
import type { NoteIndexRow } from '../shared/types'
import { noteHits } from './search'

const note = (over: Partial<NoteIndexRow>): NoteIndexRow => ({
  workspace: 'research',
  id: 'Methods',
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
    expect(noteHits(rows, 'methods')).toEqual([
      {
        key: 'Methods',
        title: 'Methods',
        detail: 'Thesis · Sep 25',
        route: '/research/notes/n/Methods'
      }
    ])
  })

  it('finds a note by its text and shows the part that matched', () => {
    const [hit] = noteHits(rows, 'luminos')
    expect(hit.title).toBe('Methods')
    expect(hit.detail).toContain('Luminos')
  })

  it('finds nothing when a word is missing, and everything for an empty query', () => {
    expect(noteHits(rows, 'luminos zebra')).toEqual([])
    expect(noteHits(rows, '')).toHaveLength(2)
  })

  it('shows at most six', () => {
    const many = Array.from({ length: 10 }, (_, i) => note({ id: `n${i}`, title: `Note ${i}` }))
    expect(noteHits(many, 'note')).toHaveLength(6)
  })
})
