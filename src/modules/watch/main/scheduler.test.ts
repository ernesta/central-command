import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { Fetcher } from './checker'
import { watchMigrations } from './migrations'
import { addSource, getSource } from './repository'
import { WatchScheduler } from './scheduler'

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, watchMigrations)
})

const RSS =
  '<rss version="2.0"><channel><item><title>T</title><link>https://ex.org/t</link></item></channel></rss>'
const NOW = '2026-10-15T09:00:00.000Z'
const add = (n: number, over = {}): number =>
  addSource(
    db,
    { title: `S${n}`, url: `https://ex.org/f${n}`, kind: 'other', method: 'feed', ...over },
    NOW
  ).id

describe('WatchScheduler', () => {
  it('checks what is due, one source at a time with a pause between, and reports once', async () => {
    const a = add(1)
    const b = add(2)
    add(3, { intervalHours: 1 })
    db.prepare(
      "UPDATE watch_sources SET last_checked_at = '2026-10-15T08:30:00.000Z' WHERE id = 3"
    ).run()
    const calls: string[] = []
    const fetcher: Fetcher = async (url) => {
      calls.push(url)
      return { status: 200, headers: { get: () => null }, text: async () => RSS }
    }
    const sleep = vi.fn(async () => undefined)
    const onChange = vi.fn()
    const s = new WatchScheduler({ db, fetcher, now: () => NOW, sleep, gapMs: 5, onChange })
    const out = await s.runDue()
    expect(calls).toEqual(['https://ex.org/f1', 'https://ex.org/f2'])
    expect(out.map((o) => o.sourceId)).toEqual([a, b])
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(getSource(db, a)!.lastOkAt).toBe(NOW)
  })

  it('joins a run already going instead of starting a second', async () => {
    add(1)
    let hits = 0
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const fetcher: Fetcher = async () => {
      hits++
      await gate
      return { status: 200, headers: { get: () => null }, text: async () => RSS }
    }
    const s = new WatchScheduler({ db, fetcher, now: () => NOW, sleep: async () => undefined })
    const first = s.runDue()
    const second = s.checkNow()
    release()
    expect(await first).toBe(await second)
    expect(hits).toBe(1)
  })

  it('checkNow ignores the schedule but not the active flag, and a missing id is skipped', async () => {
    const a = add(1)
    const b = add(2, {})
    db.prepare('UPDATE watch_sources SET active = 0 WHERE id = ?').run(b)
    const fetcher: Fetcher = async () => ({
      status: 200,
      headers: { get: () => null },
      text: async () => RSS
    })
    const s = new WatchScheduler({ db, fetcher, now: () => NOW, sleep: async () => undefined })
    expect((await s.checkNow()).map((o) => o.sourceId)).toEqual([a])
    expect(await s.checkNow(999)).toEqual([])
    expect((await s.checkNow(b)).map((o) => o.sourceId)).toEqual([b])
  })

  it('a failing source does not stop the next one', async () => {
    const a = add(1)
    const b = add(2)
    const fetcher: Fetcher = async (url) =>
      url.endsWith('f1')
        ? Promise.reject(new Error('down'))
        : { status: 200, headers: { get: () => null }, text: async () => RSS }
    const s = new WatchScheduler({ db, fetcher, now: () => NOW, sleep: async () => undefined })
    const out = await s.checkNow()
    expect(out.map((o) => [o.sourceId, o.status])).toEqual([
      [a, 'error'],
      [b, 'ok']
    ])
  })
})
