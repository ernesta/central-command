import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyYear, type Moment, type TrackingYear } from '@shared/tracking/types'
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

describe('Work contracts', () => {
  const START = '2026-05-01'
  const END = '2026-10-29'
  const contract = (store = open()): TrackingStore => {
    expect(store.createContract('work', START, END).ok).toBe(true)
    return store
  }

  it('has no year until a contract is made, and the timer will not start without one', () => {
    const store = open()
    expect(store.years('work')).toEqual([])
    expect(store.start('work', 'A')).toEqual({ ok: false, reason: 'outside-year' })
    expect(() => store.get('work', START)).toThrow('unknown-year')
  })

  it('makes a contract of whole weeks: eight hours a week over every day, aimed at by the week, no days off', () => {
    const store = contract()
    const year = store.get('work', START)
    expect(year.weeks).toBe(26)
    expect(year.plan).toEqual({
      hoursPerWeek: 480,
      workDays: [1, 2, 3, 4, 5, 6, 7],
      allowanceDays: 0,
      weekAim: true,
      clients: ['Impact', 'Teaching & Learning']
    })
    expect(read('work', `${START}.json`).weeks).toBe(26)
    expect(store.years('work')).toEqual([START])
  })

  it('refuses a start that is not a date, an end that does not make whole weeks, and an overlap', () => {
    const store = contract()
    expect(store.createContract('work', '2026-11-31', '2027-04-29')).toEqual({
      ok: false,
      reason: 'bad-start'
    })
    expect(store.createContract('work', '2026-10-30', '2027-04-30')).toEqual({
      ok: false,
      reason: 'bad-end'
    })
    expect(store.createContract('work', '2026-10-23', '2026-11-26')).toEqual({
      ok: false,
      reason: 'overlap'
    })
    expect(store.createContract('research', '2026-10-30', '2027-04-29')).toEqual({
      ok: false,
      reason: 'no-contracts'
    })
  })

  it('takes a contract that starts on any weekday, next to another (Wednesday to Tuesday before Friday to Thursday)', () => {
    const store = contract()
    expect(store.createContract('work', '2025-10-01', '2026-03-31').ok).toBe(true)
    expect(store.years('work')).toEqual([START, '2025-10-01'])
    expect(store.get('work', '2025-10-01').weeks).toBe(26)
    expect(store.createContract('work', '2026-03-31', '2026-04-27')).toEqual({
      ok: false,
      reason: 'overlap'
    })
  })

  it('tracks inside the contract, and not after its last day', () => {
    const store = contract()
    at('2026-10-29', '10:00:00')
    expect(store.start('work', 'A').ok).toBe(true)
    at('2026-10-30', '10:00:00')
    store.stop()
    expect(store.start('work', 'B')).toEqual({ ok: false, reason: 'outside-year' })
  })

  it('moves the last day, but never past time that was tracked after it', () => {
    const store = contract()
    expect(store.setContractEnd('work', START, '2026-11-05').ok).toBe(true)
    expect(store.get('work', START).weeks).toBe(27)
    at('2026-11-03', '10:00:00')
    store.start('work', 'A')
    at('2026-11-03', '10:30:00')
    store.stop()
    expect(store.setContractEnd('work', START, '2026-10-29')).toEqual({
      ok: false,
      reason: 'has-time-after'
    })
  })

  it('starts the next contract with the previous plan and carry', () => {
    const store = contract()
    store.setPlan('work', START, { hoursPerWeek: 600 })
    expect(store.createContract('work', '2026-10-30', '2027-04-29').ok).toBe(true)
    expect(store.get('work', '2026-10-30').plan.hoursPerWeek).toBe(600)
    expect(store.years('work')).toEqual(['2026-10-30', START])
  })
})

describe('clients on Work entries', () => {
  const START = '2026-09-25'
  const contract = (): TrackingStore => {
    const store = open()
    expect(store.createContract('work', START, '2026-10-22').ok).toBe(true)
    return store
  }

  it('saves the client of a timer, of typed time and of a change, and refuses one not on the list', () => {
    const store = contract()
    store.start('work', 'Calls', undefined, 'Teaching & Learning')
    at('2026-09-29', '11:00:00')
    store.stop()
    expect(read('work', `${START}.json`).sessions[0].client).toBe('Teaching & Learning')
    expect(store.addTime('work', START, '2026-09-29', 'Emails', 30, 'Impact').ok).toBe(true)
    expect(store.addTime('work', START, '2026-09-29', 'Emails', 30, 'Luminos')).toEqual({
      ok: false,
      reason: 'bad-client'
    })
    expect(
      store.setClient('work', START, '2026-09-29', 'Calls', 'Teaching & Learning', 'Impact').ok
    ).toBe(true)
    const doc = read('work', `${START}.json`)
    expect(doc.sessions[0].client).toBe('Impact')
    expect(doc.adjusts.map((a: Doc) => a.client)).toEqual(['Impact'])
  })

  it('gives a timer started without a client the default one', () => {
    const store = contract()
    store.start('work', 'Calls')
    expect(store.running()?.session.client).toBe('Impact')
  })

  it('changes the client list through the plan and refuses a bad one', () => {
    const store = contract()
    expect(store.setPlan('work', START, { clients: ['Impact', 'Other'] }).ok).toBe(true)
    expect(read('work', `${START}.json`).plan.clients).toEqual(['Impact', 'Other'])
    expect(store.setPlan('work', START, { clients: ['Impact', 'impact'] })).toEqual({
      ok: false,
      reason: 'bad-plan'
    })
  })

  it('leaves Research without clients, whatever is asked', () => {
    const store = open()
    store.start('research', 'Reading', undefined, 'Impact')
    expect(store.running()?.session.client).toBeUndefined()
    expect(read('research', '2026-27.json').plan.clients).toBeUndefined()
  })
})

describe('a new year', () => {
  it('takes the previous plan and its final carry', () => {
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
    store.createContract('work', '2026-09-25', '2027-03-25')
    store.start('research', 'A')
    at('2026-09-29', '10:30:00')
    const result = store.start('work', 'B')
    expect(result.ok && result.running?.workspace).toBe('work')
    expect(read('research', '2026-27.json').sessions[0].end).toBe('10:30:00')
    expect(read('work', '2026-09-25.json').sessions[0].end).toBeNull()
  })

  it('stops the running task and reports none afterwards', () => {
    const store = open()
    store.start('research', 'A')
    at('2026-09-29', '10:30:00')
    expect(store.stop()).toEqual({ ok: true, running: null })
    expect(store.stop()).toEqual({ ok: true, running: null })
    expect(read('research', '2026-27.json').sessions[0].minutes).toBe(30)
  })

  it('starts without a name, which can be given later', () => {
    const store = open()
    store.start('research', 'A')
    at('2026-09-29', '10:00:00')
    expect(store.start('research', '  ').ok).toBe(true)
    expect(store.running()?.session.label).toBe('')
    expect(store.renameTask('research', '2026-09-21', '2026-09-29', '', 'Reading').ok).toBe(true)
    expect(store.running()?.session.label).toBe('Reading')
  })

  it('stops a timer by itself at the day end, and not before', () => {
    const store = open()
    at('2026-09-29', '23:00:00')
    store.start('research', 'A')
    at('2026-09-29', '26:30:00')
    store.closeFinishedDays()
    expect(store.running()).not.toBeNull()
    at('2026-09-30', '04:00:00')
    store.closeFinishedDays()
    expect(store.running()).toBeNull()
    const session = store.get('research', '2026-09-21').sessions[0]
    expect(session).toMatchObject({ end: '27:59:59', minutes: 300 })
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

describe('importing a year', () => {
  const imported = (): TrackingYear => ({
    ...emptyYear('2025-09-22'),
    days: { '2025-09-23': { minutes: 465 } },
    timeOff: [{ date: '2025-12-24', type: 'public' }],
    weekDays: { '2025-09-22': 4 }
  })

  it('writes a year that has no file, and the year reads back as imported', () => {
    const store = open()
    expect(store.importYear('research', imported()).ok).toBe(true)
    expect(read('research', '2025-26.json').days['2025-09-23'].minutes).toBe(465)
    expect(store.get('research', '2025-09-22').weekDays).toEqual({ '2025-09-22': 4 })
  })

  it('replaces the empty file the app makes for the current year, keeping its carry', () => {
    const store = open()
    store.get('research', '2026-09-21')
    const next = { ...emptyYear('2026-09-21'), days: { '2026-09-22': { minutes: 450 } } }
    expect(store.importYear('research', next).ok).toBe(true)
    expect(read('research', '2026-27.json').days['2026-09-22'].minutes).toBe(450)
  })

  it('never overwrites a year that holds anything', () => {
    const store = open()
    store.importYear('research', imported())
    const before = readFileSync(file('research', '2025-26.json'), 'utf8')
    const again = { ...imported(), days: { '2025-09-24': { minutes: 15 } } }
    expect(store.importYear('research', again)).toEqual({ ok: false, reason: 'not-empty' })
    expect(readFileSync(file('research', '2025-26.json'), 'utf8')).toBe(before)
    store.setNote('research', '2026-09-21', '2026-09-22', 'note')
    expect(store.importYear('research', emptyYear('2026-09-21')).ok).toBe(false)
  })
})
