import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { Fetcher } from './checker'
import { watchMigrations } from './migrations'
import {
  addSource,
  getCounts,
  listItems,
  listSources,
  markAllSeen,
  updateSource,
  upcoming
} from './repository'
import { WatchScheduler } from './scheduler'

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, watchMigrations)
})

const NOW = '2026-10-15T09:00:00.000Z'
const source = (n: number, workspace?: 'research' | 'life'): number =>
  addSource(
    db,
    { title: `S${n}`, url: `https://ex.org/f${n}`, kind: 'conference', method: 'feed', workspace },
    NOW
  ).id
const item = (
  sourceId: number,
  key: string,
  over: { state?: string; date?: string | null; score?: number } = {}
): void => {
  db.prepare(
    `INSERT INTO watch_items (source_id, item_key, title, url, deadline, score, state, first_seen_at)
     VALUES (?, ?, ?, 'https://ex.org/i', ?, ?, ?, '2026-10-14T00:00:00.000Z')`
  ).run(sourceId, key, `Item ${key}`, over.date ?? null, over.score ?? 0, over.state ?? 'new')
}

describe('Watch per workspace', () => {
  it('a source is Research’s unless it says otherwise, and the list can be one workspace’s', () => {
    const r = source(1)
    const l = source(2, 'life')
    expect(listSources(db).map((s) => [s.id, s.workspace])).toEqual([
      [r, 'research'],
      [l, 'life']
    ])
    expect(listSources(db, 'life').map((s) => s.id)).toEqual([l])
    expect(listSources(db, 'research').map((s) => s.id)).toEqual([r])
    expect(() => source(3, 'work' as never)).toThrow('Invalid workspace')
  })

  it('a source can move to the other workspace, taking its items with it', () => {
    const s = source(1)
    item(s, 'a')
    updateSource(db, s, { workspace: 'life' })
    expect(listItems(db, { workspace: 'life' }).map((i) => i.title)).toEqual(['Item a'])
    expect(listItems(db, { workspace: 'research' })).toEqual([])
    expect(() => updateSource(db, s, { workspace: 'work' as never })).toThrow('Invalid workspace')
  })

  it('items belong to their source’s workspace and never cross', () => {
    const r = source(1)
    const l = source(2, 'life')
    item(r, 'r1')
    item(l, 'l1')
    item(l, 'l2', { state: 'seen' })
    expect(listItems(db, { workspace: 'research' }).map((i) => [i.title, i.workspace])).toEqual([
      ['Item r1', 'research']
    ])
    expect(
      listItems(db, { workspace: 'life' })
        .map((i) => [i.title, i.workspace])
        .sort()
    ).toEqual([
      ['Item l1', 'life'],
      ['Item l2', 'life']
    ])
    expect(
      listItems(db)
        .map((i) => i.title)
        .sort()
    ).toEqual(['Item l1', 'Item l2', 'Item r1'])
  })

  it('counts are each workspace’s own, and without a workspace they are everyone’s', () => {
    const r = source(1)
    const l = source(2, 'life')
    const off = source(3, 'life')
    db.prepare('UPDATE watch_sources SET active = 0 WHERE id = ?').run(off)
    db.prepare("UPDATE watch_sources SET last_error = 'x' WHERE id = ?").run(l)
    item(r, 'r1', { score: 2 })
    item(l, 'l1')
    item(l, 'l2')
    item(l, 'l3', { state: 'seen' })
    expect(getCounts(db, 'research')).toEqual({
      new: 1,
      newRelevant: 1,
      sources: 1,
      failing: 0,
      changed: 0
    })
    expect(getCounts(db, 'life')).toEqual({
      new: 2,
      newRelevant: 0,
      sources: 1,
      failing: 1,
      changed: 0
    })
    expect(getCounts(db)).toMatchObject({ new: 3, sources: 2, failing: 1 })
  })

  it('saved dates are each workspace’s own', () => {
    const r = source(1)
    const l = source(2, 'life')
    item(r, 'r1', { state: 'saved', date: '2026-10-20' })
    item(l, 'l1', { state: 'saved', date: '2026-10-21' })
    item(l, 'l2', { state: 'new', date: '2026-10-22' })
    expect(upcoming(db, '2026-10-15', 60, 50, 'life').map((i) => i.title)).toEqual(['Item l1'])
    expect(upcoming(db, '2026-10-15', 60, 50, 'research').map((i) => i.title)).toEqual(['Item r1'])
    expect(upcoming(db, '2026-10-15', 60).map((i) => i.title)).toEqual(['Item r1', 'Item l1'])
  })

  it('“looked at everything” in one workspace leaves the other’s new items new', () => {
    const r = source(1)
    const l = source(2, 'life')
    item(r, 'r1')
    item(l, 'l1')
    db.prepare("UPDATE watch_sources SET changed_at = 'x'").run()
    expect(markAllSeen(db, undefined, 'life')).toBe(1)
    expect(getCounts(db, 'research').new).toBe(1)
    expect(getCounts(db, 'life').new).toBe(0)
    expect(getCounts(db, 'research').changed).toBe(1)
    expect(getCounts(db, 'life').changed).toBe(0)
    expect(markAllSeen(db)).toBe(1)
  })

  it('a check of one workspace’s sources leaves the other’s alone, and its items stay in it', async () => {
    const r = source(1)
    const l = source(2, 'life')
    const asked: string[] = []
    const fetcher: Fetcher = async (url) => {
      asked.push(url)
      return {
        status: 200,
        headers: { get: () => null },
        text: async () =>
          `<rss version="2.0"><channel><item><title>From ${url.slice(-2)}</title><link>${url}/i</link></item></channel></rss>`
      }
    }
    const scheduler = new WatchScheduler({
      db,
      fetcher,
      now: () => NOW,
      gapMs: 0,
      sleep: async () => {}
    })
    // the first good check of a source is only its baseline; the second finds what is new
    await scheduler.checkNow(undefined, 'life')
    expect(asked).toEqual(['https://ex.org/f2'])
    db.prepare('UPDATE watch_sources SET last_ok_at = ? WHERE id = ?').run(
      '2026-10-01T00:00:00.000Z',
      l
    )
    db.prepare('UPDATE watch_sources SET last_ok_at = ? WHERE id = ?').run(
      '2026-10-01T00:00:00.000Z',
      r
    )
    await scheduler.checkNow()
    expect(listItems(db, { workspace: 'life' }).every((i) => i.sourceId === l)).toBe(true)
    expect(listItems(db, { workspace: 'research' }).every((i) => i.sourceId === r)).toBe(true)
    expect(listItems(db).length).toBeGreaterThan(0)
  })
})

describe('the workspace migration', () => {
  it('makes every existing source Research’s', () => {
    const old = new Database(':memory:')
    runMigrations(old, watchMigrations.slice(0, 3))
    old
      .prepare(
        "INSERT INTO watch_sources (title, url, kind, method, created_at) VALUES ('S', 'https://ex.org/s', 'conference', 'feed', 'x')"
      )
      .run()
    old
      .prepare(
        "INSERT INTO watch_items (source_id, item_key, title, url, state, first_seen_at) VALUES (1, 'k', 'T', 'https://ex.org/i', 'new', 'x')"
      )
      .run()
    runMigrations(old, watchMigrations)
    expect(listSources(old).map((s) => s.workspace)).toEqual(['research'])
    expect(listItems(old, { workspace: 'research' }).map((i) => i.title)).toEqual(['T'])
    expect(listItems(old, { workspace: 'life' })).toEqual([])
    expect(watchMigrations.map((m) => m.id).slice(0, 3)).toEqual([
      'watch/0001_init',
      'watch/0002_two_kinds',
      'watch/0003_item_kind'
    ])
  })
})
