import { describe, expect, it } from 'vitest'
import { deriveGroups } from './groups'
import {
  DEFAULT_NOTES_QUERY,
  displayTitle,
  noteCount,
  normaliseNotesQuery,
  queryNotes,
  reconcileQuery,
  recentNotes
} from './query'
import type { NoteIndexRow } from './types'

function note(id: string, over: Partial<NoteIndexRow> = {}): NoteIndexRow {
  return {
    workspace: 'research',
    id,
    title: id,
    group: '',
    subgroup: '',
    pinned: false,
    created: '',
    edited: 1,
    firstLine: '',
    excerpt: '',
    problems: [],
    contentHash: 'h',
    ...over
  }
}

const rows = [
  note('Methods', {
    group: 'Thesis',
    subgroup: 'Methods',
    edited: 30,
    excerpt: 'Schools were recruited'
  }),
  note('Weights', { group: 'Analysis', edited: 50, excerpt: 'Weights were applied twice' }),
  note('Loose', {
    edited: 40,
    title: '',
    firstLine: 'Ask about the R course',
    excerpt: 'Ask about the R course'
  })
]

describe('queryNotes', () => {
  it('puts the most recently edited first', () => {
    expect(queryNotes(rows, DEFAULT_NOTES_QUERY).map((r) => r.id)).toEqual([
      'Weights',
      'Loose',
      'Methods'
    ])
  })

  it('filters by group, including its subgroups', () => {
    const q = { search: '', group: { scope: 'group', group: 'thesis', subgroup: '' } } as const
    expect(queryNotes(rows, q).map((r) => r.id)).toEqual(['Methods'])
    expect(
      queryNotes(rows, { search: '', group: { scope: 'ungrouped' } }).map((r) => r.id)
    ).toEqual(['Loose'])
  })

  it('searches every word in the title, first line, group and text, ignoring case and accents', () => {
    const search = (s: string): string[] =>
      queryNotes(rows, { ...DEFAULT_NOTES_QUERY, search: s }).map((r) => r.id)
    expect(search('WEIGHTS twice')).toEqual(['Weights'])
    expect(search('thesis methods')).toEqual(['Methods'])
    expect(search('r course')).toEqual(['Loose'])
    expect(search('nothing here')).toEqual([])
  })
})

describe('display', () => {
  it('shows the title, else the first line, else Untitled', () => {
    expect(displayTitle({ title: 'T', firstLine: 'F' })).toBe('T')
    expect(displayTitle({ title: '', firstLine: 'F' })).toBe('F')
    expect(displayTitle({ title: '', firstLine: '' })).toBe('Untitled')
    expect(noteCount(1)).toBe('1 note')
    expect(noteCount(12)).toBe('12 notes')
  })

  it('lists the latest few', () => {
    expect(recentNotes(rows, 2).map((r) => r.id)).toEqual(['Weights', 'Loose'])
  })
})

describe('remembered query', () => {
  it('reads it leniently and drops a group that is gone', () => {
    expect(normaliseNotesQuery(undefined)).toEqual(DEFAULT_NOTES_QUERY)
    const q = normaliseNotesQuery({ search: 'x', group: { scope: 'group', group: 'Gone' } })
    expect(reconcileQuery(q, deriveGroups(rows))).toEqual({ search: 'x', group: { scope: 'all' } })
  })
})
