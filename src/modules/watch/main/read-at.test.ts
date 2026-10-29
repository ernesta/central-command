import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { watchMigrations } from './migrations'
import { addSource, listItems, markAllSeen, openItem, setItemState } from './repository'

let db: Database.Database
let sourceId: number
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, watchMigrations)
  sourceId = addSource(db, { title: 'S', url: 'https://ex.org/f', method: 'feed' }, 'x').id
})

const add = (key: string, day: string, state = 'new'): number =>
  Number(
    db
      .prepare(
        `INSERT INTO watch_items (source_id, item_key, title, url, state, first_seen_at)
         VALUES (?, ?, ?, 'https://ex.org/i', ?, ?)`
      )
      .run(sourceId, key, `Item ${key}`, state, `${day}T00:00:00.000Z`).lastInsertRowid
  )
const readAt = (id: number): string | null =>
  (db.prepare('SELECT read_at FROM watch_items WHERE id = ?').get(id) as { read_at: string | null })
    .read_at

describe('read_at', () => {
  it('is set when an item becomes Read by opening, Mark read, Mark all or un-saving', () => {
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((k) => add(k, '2026-10-01'))
    openItem(db, a, '2026-10-20T10:00:00.000Z')
    setItemState(db, b, 'seen', { now: '2026-10-21T10:00:00.000Z' })
    setItemState(db, c, 'saved')
    setItemState(db, c, 'seen', { now: '2026-10-22T10:00:00.000Z' })
    markAllSeen(db, undefined, undefined, '2026-10-23T10:00:00.000Z')
    expect([a, b, c, d].map(readAt)).toEqual([
      '2026-10-20T10:00:00.000Z',
      '2026-10-21T10:00:00.000Z',
      '2026-10-22T10:00:00.000Z',
      '2026-10-23T10:00:00.000Z'
    ])
  })

  it('is cleared by Mark new, and left alone by Save', () => {
    const a = add('a', '2026-10-01')
    setItemState(db, a, 'seen', { now: '2026-10-20T10:00:00.000Z' })
    setItemState(db, a, 'saved', { now: '2026-10-21T10:00:00.000Z' })
    expect(readAt(a)).toBe('2026-10-20T10:00:00.000Z')
    setItemState(db, a, 'new')
    expect(readAt(a)).toBeNull()
  })

  it('opening a read or saved item changes nothing', () => {
    const a = add('a', '2026-10-01', 'seen')
    openItem(db, a, '2026-10-25T00:00:00.000Z')
    expect(readAt(a)).toBeNull()
  })

  it('an undo puts the time it had back, including none', () => {
    const a = add('a', '2026-10-01')
    setItemState(db, a, 'seen', { now: '2026-10-20T10:00:00.000Z' })
    setItemState(db, a, 'new')
    setItemState(db, a, 'seen', { readAt: '2026-10-20T10:00:00.000Z' })
    expect(readAt(a)).toBe('2026-10-20T10:00:00.000Z')
    setItemState(db, a, 'new', { readAt: null })
    expect(readAt(a)).toBeNull()
  })

  it('lists Read most recently read first, those with no time after them by the day found', () => {
    const old = add('old', '2026-10-25', 'seen')
    const early = add('early', '2026-10-01', 'seen')
    const late = add('late', '2026-10-02', 'seen')
    const fresh = add('fresh', '2026-10-03', 'new')
    setItemState(db, early, 'seen', { now: '2026-10-20T00:00:00.000Z' })
    setItemState(db, late, 'seen', { now: '2026-10-28T00:00:00.000Z' })
    expect(listItems(db).map((i) => i.id)).toEqual([fresh, late, early, old])
    expect(listItems(db).find((i) => i.id === late)?.readAt).toBe('2026-10-28T00:00:00.000Z')
  })
})
