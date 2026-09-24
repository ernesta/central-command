import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from './migrate'

const create = { id: 'a/0001_create', sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)' }
const addCol = { id: 'a/0002_add', sql: 'ALTER TABLE t ADD COLUMN w TEXT' }

describe('runMigrations', () => {
  it('applies migrations in id order regardless of input order', () => {
    const db = new Database(':memory:')
    expect(runMigrations(db, [addCol, create])).toEqual(['a/0001_create', 'a/0002_add'])
    expect(db.prepare('PRAGMA table_info(t)').all()).toHaveLength(3)
  })

  it('is idempotent: a second run applies nothing', () => {
    const db = new Database(':memory:')
    runMigrations(db, [create, addCol])
    expect(runMigrations(db, [create, addCol])).toEqual([])
  })

  it('applies only new migrations on later runs', () => {
    const db = new Database(':memory:')
    runMigrations(db, [create])
    expect(runMigrations(db, [create, addCol])).toEqual(['a/0002_add'])
  })

  it('rolls back a failing migration and keeps earlier ones', () => {
    const db = new Database(':memory:')
    const bad = { id: 'a/0002_bad', sql: 'ALTER TABLE t ADD COLUMN x TEXT; SELECT * FROM nope' }
    expect(() => runMigrations(db, [create, bad])).toThrow()
    const cols = db.prepare('PRAGMA table_info(t)').all() as { name: string }[]
    expect(cols.map((c) => c.name)).toEqual(['id', 'v'])
    expect(db.prepare('SELECT id FROM schema_migrations').all()).toEqual([{ id: 'a/0001_create' }])
  })

  it('rejects duplicate ids', () => {
    expect(() => runMigrations(new Database(':memory:'), [create, create])).toThrow(/Duplicate/)
  })
})
