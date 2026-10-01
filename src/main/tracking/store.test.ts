import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Moment } from '@shared/tracking/types'
import { TrackingStore, yearFileName, type TrackingDeps } from './store'

const STARTS = ['2025-09-22', '2026-09-21']
let dir: string
let clock: Moment
let events: { workspace: string; year: string }[]
let n: number

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-time-'))
  clock = { date: '2026-09-29', time: '10:00:00' }
  events = []
  n = 0
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function open(extra: Partial<TrackingDeps> = {}): TrackingStore {
  return new TrackingStore(dir, {
    starts: () => STARTS,
    now: () => clock,
    newId: () => `id${++n}`,
    onChange: (e) => events.push(e),
    ...extra
  })
}

const file = (workspace: string, name: string): string => join(dir, workspace, name)
type Doc = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const read = (workspace: string, name: string): Doc =>
  JSON.parse(readFileSync(file(workspace, name), 'utf8'))
const at = (date: string, time: string): void => {
  clock = { date, time }
}

describe('file name', () => {
  it('is the year as 2026-27', () => {
    expect(yearFileName('2026-09-21')).toBe('2026-27.json')
    expect(yearFileName('2025-09-22')).toBe('2025-26.json')
  })
})

describe('the current year', () => {
  it('is created on first read, at time/<workspace>/2026-27.json, with the default plan', () => {
    const year = open().get('research', '2026-09-21')
    expect(year.plan).toEqual({ hoursPerWeek: 2250, workDays: [1, 2, 3, 4, 5], allowanceDays: 40 })
    expect(read('research', '2026-27.json').start).toBe('2026-09-21')
  })

  it('refuses a year the shared list does not know', () => {
    expect(() => open().get('research', '2026-09-28')).toThrow('unknown-year')
    expect(open().setNote('research', '2026-09-28', '2026-09-29', 'x')).toEqual({
      ok: false,
      reason: 'unknown-year'
    })
  })

  it('does not create a file for a past year that is only looked at', () => {
    open().get('research', '2025-09-22')
    expect(() => readdirSync(join(dir, 'research'))).toThrow()
  })

  it('lists every year with a file plus the current one, newest first', () => {
    const store = open()
    expect(store.years('research')).toEqual(['2026-09-21'])
    store.setNote('research', '2025-09-22', '2025-10-01', 'old')
    expect(store.years('research')).toEqual(['2026-09-21', '2025-09-22'])
  })
})

describe('a new year', () => {
  it('takes the previous plan and its final carry, per workspace', () => {
    const store = open()
    store.setPlan('research', '2025-09-22', { hoursPerWeek: 1800, workDays: [1, 2, 3, 4] })
    // 20 minutes exact reports 0:15, leaving 5 minutes (300 s) in the carry
    at('2025-10-01', '09:00:00')
    store.start('research', 'A')
    at('2025-10-01', '09:20:00')
    store.stop()
    at('2026-09-22', '09:00:00')
    const next = store.get('research', '2026-09-21')
    expect(next.plan.hoursPerWeek).toBe(1800)
    expect(next.plan.workDays).toEqual([1, 2, 3, 4])
    expect(next.carryIn).toBe(300)
    expect(store.get('work', '2026-09-21').plan.hoursPerWeek).toBe(2250)
    expect(store.get('work', '2026-09-21').carryIn).toBe(0)
  })
})

describe('the timer', () => {
  it('writes the session before start returns: a new store (a quit and reopen) still sees it running', () => {
    open().start('research', 'Deck')
    const reopened = open()
    const running = reopened.running()
    expect(running?.session.label).toBe('Deck')
    expect(running?.session.end).toBeNull()
    expect(running?.year).toBe('2026-09-21')
    expect(read('research', '2026-27.json').sessions).toHaveLength(1)
  })

  it('switching is one write: the old task is closed and the new one started together', () => {
    const store = open()
    store.start('research', 'A')
    events.length = 0
    at('2026-09-29', '10:20:00')
    store.start('research', 'B')
    expect(events).toHaveLength(1)
    const sessions = read('research', '2026-27.json').sessions
    expect(
      sessions.map((s: { label: string; end: string | null; minutes?: number }) => [
        s.label,
        s.end,
        s.minutes
      ])
    ).toEqual([
      ['A', '10:20:00', 15],
      ['B', null, undefined]
    ])
  })

  it('starting the task that already runs changes nothing', () => {
    const store = open()
    store.start('research', 'A')
    events.length = 0
    at('2026-09-29', '10:05:00')
    store.start('research', ' a ')
    expect(events).toHaveLength(0)
    expect(read('research', '2026-27.json').sessions).toHaveLength(1)
  })

  it('keeps one timer for the whole app: starting in another workspace stops the first', () => {
    const store = open()
    store.start('research', 'A')
    at('2026-09-29', '10:30:00')
    const result = store.start('work', 'B')
    expect(result.ok && result.running?.workspace).toBe('work')
    expect(read('research', '2026-27.json').sessions[0].end).toBe('10:30:00')
    expect(read('work', '2026-27.json').sessions[0].end).toBeNull()
  })

  it('stops the running task and reports none afterwards', () => {
    const store = open()
    store.start('research', 'A')
    at('2026-09-29', '10:30:00')
    expect(store.stop()).toEqual({ ok: true, running: null })
    expect(store.stop()).toEqual({ ok: true, running: null })
    expect(read('research', '2026-27.json').sessions[0].minutes).toBe(30)
  })

  it('refuses an empty name without stopping what runs', () => {
    const store = open()
    store.start('research', 'A')
    expect(store.start('work', '  ')).toEqual({ ok: false, reason: 'empty-label' })
    expect(store.running()?.session.label).toBe('A')
  })

  it('leaves a session from an earlier day running until it is given an end time', () => {
    const store = open()
    store.start('research', 'A')
    at('2026-09-30', '09:00:00')
    expect(store.stop()).toEqual({ ok: false, reason: 'stale' })
    expect(store.start('research', 'B')).toEqual({ ok: false, reason: 'stale' })
    const id = store.running()!.session.id
    expect(store.endAt('research', '2026-09-21', id, '17:00:00').ok).toBe(true)
    expect(store.start('research', 'B').ok).toBe(true)
  })

  it("finds a session still running in last year's file across the boundary", () => {
    const store = open()
    at('2026-09-20', '23:00:00')
    store.start('research', 'Late')
    at('2026-09-21', '08:00:00')
    store.get('research', '2026-09-21')
    expect(store.running()?.year).toBe('2025-09-22')
    expect(store.start('research', 'New')).toEqual({ ok: false, reason: 'stale' })
    expect(read('research', '2025-26.json').sessions[0].end).toBeNull()
  })

  it('keeps the year total within 7½ minutes of the exact time over many switches', () => {
    const store = open()
    let seconds = 0
    let exact = 0
    for (let i = 0; i < 60; i++) {
      at(
        '2026-09-29',
        `${String(9 + Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
      )
      store.start('research', i % 2 ? 'A' : 'B')
      const len = 100 + ((i * 37) % 400)
      seconds += len
      exact += len
    }
    at(
      '2026-09-29',
      `${String(9 + Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    )
    store.stop()
    const total = read('research', '2026-27.json').sessions.reduce(
      (sum: number, s: { minutes: number }) => sum + s.minutes,
      0
    )
    expect(Math.abs(total - exact / 60)).toBeLessThanOrEqual(7.5)
  })
})

describe('editing', () => {
  it('saves typed time, a note and the plan, and refuses a bad plan', () => {
    const store = open()
    expect(store.addTime('research', '2026-09-21', '2026-09-29', 'Deck', 30).ok).toBe(true)
    expect(store.setNote('research', '2026-09-21', '2026-09-29', 'hi').ok).toBe(true)
    expect(store.setPlan('research', '2026-09-21', { hoursPerWeek: 480 }).ok).toBe(true)
    expect(store.setPlan('research', '2026-09-21', { workDays: [] })).toEqual({
      ok: false,
      reason: 'bad-plan'
    })
    const y = read('research', '2026-27.json')
    expect(y.adjusts[0].minutes).toBe(30)
    expect(y.days['2026-09-29'].note).toBe('hi')
    expect(y.plan.hoursPerWeek).toBe(480)
    expect(y.plan.workDays).toEqual([1, 2, 3, 4, 5])
  })

  it('adds and removes time off, refusing a date outside the year', () => {
    const store = open()
    expect(
      store.addTimeOff('research', '2026-09-21', '2026-12-24', '2026-12-25', 'university').ok
    ).toBe(true)
    expect(read('research', '2026-27.json').timeOff).toHaveLength(2)
    expect(
      store.addTimeOff('research', '2026-09-21', '2027-12-27', '2027-12-27', 'public')
    ).toEqual({
      ok: false,
      reason: 'outside-year'
    })
    store.removeTimeOff('research', '2026-09-21', '2026-12-24')
    expect(read('research', '2026-27.json').timeOff).toHaveLength(1)
  })
})

describe('the file', () => {
  it('keeps keys it does not know, at the top and inside entries, through a save', () => {
    const store = open()
    store.start('research', 'A')
    const doc = read('research', '2026-27.json')
    doc.future = { a: 1 }
    doc.sessions[0].colour = 'red'
    writeFileSync(file('research', '2026-27.json'), JSON.stringify(doc))
    at('2026-09-29', '10:10:00')
    store.setNote('research', '2026-09-21', '2026-09-29', 'x')
    store.stop()
    const after = read('research', '2026-27.json')
    expect(after.future).toEqual({ a: 1 })
    expect(after.sessions[0].colour).toBe('red')
  })

  it('sets a corrupt file aside, never overwrites it, and starts the year afresh', () => {
    mkdirSync(join(dir, 'research'), { recursive: true })
    writeFileSync(file('research', '2026-27.json'), '{ not json')
    const store = open()
    store.start('research', 'A')
    const names = readdirSync(join(dir, 'research'))
    const aside = names.find((x) => x.includes('.corrupt-'))!
    expect(readFileSync(file('research', aside), 'utf8')).toBe('{ not json')
    expect(read('research', '2026-27.json').sessions).toHaveLength(1)
  })

  it('sets aside a file with an entry of the wrong shape rather than dropping the entry', () => {
    mkdirSync(join(dir, 'research'), { recursive: true })
    const bad = {
      version: 1,
      start: '2026-09-21',
      sessions: [{ id: 'x', date: 'soon', start: '10:00:00', end: null, label: 'A' }]
    }
    writeFileSync(file('research', '2026-27.json'), JSON.stringify(bad))
    open().get('research', '2026-09-21')
    const aside = readdirSync(join(dir, 'research')).find((x) => x.includes('.corrupt-'))!
    expect(JSON.parse(readFileSync(file('research', aside), 'utf8')).sessions).toHaveLength(1)
  })

  it('refuses, and leaves alone, a file from a newer version of the app', () => {
    mkdirSync(join(dir, 'research'), { recursive: true })
    const text = JSON.stringify({ version: 2, start: '2026-09-21' })
    writeFileSync(file('research', '2026-27.json'), text)
    expect(() => open().get('research', '2026-09-21')).toThrow(/newer version/)
    expect(readFileSync(file('research', '2026-27.json'), 'utf8')).toBe(text)
    expect(readdirSync(join(dir, 'research'))).toEqual(['2026-27.json'])
  })

  it('redoes a change on the fresh file when it was edited between the read and the write', () => {
    const store0 = open()
    store0.get('research', '2026-09-21')
    let first = true
    const store = open({
      beforeCommit: () => {
        if (!first) return
        first = false
        const doc = read('research', '2026-27.json')
        doc.days = { '2026-09-28': { minutes: 450 } }
        writeFileSync(file('research', '2026-27.json'), JSON.stringify(doc))
      }
    })
    expect(store.setNote('research', '2026-09-21', '2026-09-29', 'mine').ok).toBe(true)
    const after = read('research', '2026-27.json')
    expect(after.days['2026-09-28'].minutes).toBe(450)
    expect(after.days['2026-09-29'].note).toBe('mine')
  })

  it('picks up an edit made outside the app on the next read', () => {
    const store = open()
    store.get('research', '2026-09-21')
    const doc = read('research', '2026-27.json')
    doc.plan.hoursPerWeek = 600
    writeFileSync(file('research', '2026-27.json'), JSON.stringify(doc))
    expect(store.get('research', '2026-09-21').plan.hoursPerWeek).toBe(600)
  })

  it('leaves no temp files behind', () => {
    const store = open()
    store.start('research', 'A')
    store.stop()
    expect(readdirSync(join(dir, 'research'))).toEqual(['2026-27.json'])
  })
})
