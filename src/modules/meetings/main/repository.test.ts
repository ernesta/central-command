import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { MeetingIndexRow } from '../shared/types'
import { meetingsMigrations } from './migrations'
import {
  deleteMeetingRow,
  getMeetingRow,
  listMeetingIds,
  listMeetingRows,
  upsertMeeting
} from './repository'

const row = (id: string, over: Partial<MeetingIndexRow> = {}): MeetingIndexRow => ({
  workspace: 'research',
  id,
  series: 'Supervision',
  date: id.slice(0, 10),
  start: null,
  end: null,
  mode: null,
  attendees: [],
  summary: '',
  excerpt: '',
  problems: [],
  contentHash: 'h',
  ...over
})

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, meetingsMigrations)
})

describe('meetings index', () => {
  it('stores and returns a row, including lists', () => {
    const r = row('2026-09-24 Supervision', {
      start: '14:00',
      mode: 'online',
      attendees: ['Kathy Rastle'],
      problems: ['x']
    })
    upsertMeeting(db, r)
    expect(getMeetingRow(db, 'research', '2026-09-24 Supervision')).toEqual(r)
  })

  it('updates in place instead of duplicating', () => {
    upsertMeeting(db, row('2026-09-24 Supervision'))
    upsertMeeting(db, row('2026-09-24 Supervision', { summary: 'new', contentHash: 'h2' }))
    expect(listMeetingIds(db, 'research')).toEqual(['2026-09-24 Supervision'])
    expect(getMeetingRow(db, 'research', '2026-09-24 Supervision')?.summary).toBe('new')
  })

  it('lists newest first and keeps workspaces apart', () => {
    upsertMeeting(db, row('2026-01-01 Other'))
    upsertMeeting(db, row('2026-09-24 Supervision'))
    upsertMeeting(db, row('2026-09-24 Other'))
    upsertMeeting(db, row('2026-05-05 Other', { workspace: 'work' }))
    expect(listMeetingRows(db, 'research').map((r) => r.id)).toEqual([
      '2026-09-24 Supervision',
      '2026-09-24 Other',
      '2026-01-01 Other'
    ])
    expect(listMeetingIds(db, 'work')).toEqual(['2026-05-05 Other'])
  })

  it('deletes a row and its TODO rows', () => {
    upsertMeeting(db, row('2026-09-24 Supervision'))
    const pk = (db.prepare('SELECT id FROM meetings').get() as { id: number }).id
    db.prepare(
      "INSERT INTO meeting_todos (meeting_pk, position, kind, text) VALUES (?, 0, 'inline', 't')"
    ).run(pk)
    deleteMeetingRow(db, 'research', '2026-09-24 Supervision')
    expect(getMeetingRow(db, 'research', '2026-09-24 Supervision')).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS n FROM meeting_todos').get()).toEqual({ n: 0 })
  })

  it('does not let an upsert wipe the TODO rows of a meeting', () => {
    upsertMeeting(db, row('2026-09-24 Supervision'))
    const pk = (db.prepare('SELECT id FROM meetings').get() as { id: number }).id
    db.prepare(
      "INSERT INTO meeting_todos (meeting_pk, position, kind, text) VALUES (?, 0, 'inline', 't')"
    ).run(pk)
    upsertMeeting(db, row('2026-09-24 Supervision', { summary: 'changed' }))
    expect(db.prepare('SELECT COUNT(*) AS n FROM meeting_todos').get()).toEqual({ n: 1 })
  })

  it('rejects an unknown mode', () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO meetings (workspace, meeting_id, mode, content_hash) VALUES ('research', 'x', 'hybrid', 'h')"
        )
        .run()
    ).toThrow(/CHECK/)
  })
})
