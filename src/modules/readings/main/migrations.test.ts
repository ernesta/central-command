import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { readingsMigrations } from './migrations'

function freshDb(): Database.Database {
  const db = new Database(':memory:')
  runMigrations(db, readingsMigrations)
  return db
}

const insert = (db: Database.Database, citekey: string, status = 'unset'): void => {
  db.prepare(
    `INSERT INTO readings (citekey, short_citation, full_title, status, added_at, updated_at)
     VALUES (?, 'S (2020)', 'T', ?, 'now', 'now')`
  ).run(citekey, status)
}

describe('readings migration 0001', () => {
  it('creates the readings and sync_runs tables', () => {
    const tables = freshDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name)
    expect(tables).toContain('readings')
    expect(tables).toContain('sync_runs')
  })

  it('enforces unique citekeys', () => {
    const db = freshDb()
    insert(db, 'a')
    expect(() => insert(db, 'a')).toThrow(/UNIQUE/)
  })

  it('rejects unknown statuses', () => {
    expect(() => insert(freshDb(), 'a', 'maybe')).toThrow(/CHECK/)
  })

  it('applies defaults for flags and caches', () => {
    const db = freshDb()
    insert(db, 'a')
    expect(db.prepare('SELECT * FROM readings').get()).toMatchObject({
      authors: '[]',
      tags: '[]',
      missing_from_source: 0,
      has_notes: 0,
      notes_excerpt: '',
      abstract: null,
      year: null
    })
  })
})
