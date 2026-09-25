import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { NoteIndexRow } from '../shared/types'
import { notesMigrations } from './migrations'
import { deleteNoteRow, getNoteRow, listNoteIds, listNoteRows, upsertNote } from './repository'

let db: Database.Database

const row = (id: string, over: Partial<NoteIndexRow> = {}): NoteIndexRow => ({
  workspace: 'research',
  id,
  title: id,
  group: 'Thesis',
  subgroup: 'Methods',
  pinned: true,
  created: '2026-09-03',
  edited: 100,
  firstLine: 'First',
  excerpt: 'First and more',
  problems: ['x'],
  contentHash: 'abc',
  ...over
})

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db, notesMigrations)
})

describe('notes repository', () => {
  it('stores and reads back a row', () => {
    upsertNote(db, row('a'))
    expect(getNoteRow(db, 'research', 'a')).toEqual(row('a'))
    expect(getNoteRow(db, 'research', 'missing')).toBeNull()
  })

  it('replaces a row on a second upsert', () => {
    upsertNote(db, row('a'))
    upsertNote(db, row('a', { title: 'New', pinned: false, group: '', subgroup: '', edited: 200 }))
    expect(listNoteRows(db, 'research')).toEqual([
      row('a', { title: 'New', pinned: false, group: '', subgroup: '', edited: 200 })
    ])
  })

  it('lists most recently edited first, ties by id, per workspace', () => {
    upsertNote(db, row('b', { edited: 5 }))
    upsertNote(db, row('a', { edited: 5 }))
    upsertNote(db, row('c', { edited: 9 }))
    upsertNote(db, row('w', { workspace: 'work' }))
    expect(listNoteRows(db, 'research').map((r) => r.id)).toEqual(['c', 'a', 'b'])
    expect(listNoteIds(db, 'work')).toEqual(['w'])
  })

  it('deletes a row', () => {
    upsertNote(db, row('a'))
    deleteNoteRow(db, 'research', 'a')
    expect(listNoteIds(db, 'research')).toEqual([])
  })
})
