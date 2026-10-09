import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createClientTasks } from '../../modules/tasks/main/client-tasks'
import { tasksMigrations } from '../../modules/tasks/main/migrations'
import { TasksStore } from '../../modules/tasks/main/tasks-store'
import { workClients } from '../../modules/tasks/shared/work-lists'
import { runMigrations } from '../db/migrate'
import { TrackingStore } from './store'

let dir: string
let db: Database.Database
let tracking: TrackingStore
let tasks: TasksStore
let moved: number

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-client-lists-'))
  db = new Database(':memory:')
  runMigrations(db, tasksMigrations)
  tracking = new TrackingStore(dir, {
    starts: () => ['2026-09-21'],
    now: () => ({ date: '2026-09-29', time: '10:00:00' })
  })
  moved = 0
  tracking.setClientTasks(createClientTasks(db, () => moved++))
  tasks = new TasksStore(db, undefined, () =>
    workClients(tracking.years('work').map((y) => tracking.get('work', y).plan))
  )
  // Two contracts that do not overlap, both with Impact; one more client in the first.
  expect(
    tracking.createContract('work', '2026-09-25', '2026-10-22', {
      name: 'One',
      clients: ['Impact', 'Teaching']
    }).ok
  ).toBe(true)
  expect(
    tracking.createContract('work', '2026-10-23', '2026-11-19', {
      name: 'Two',
      clients: ['Impact']
    }).ok
  ).toBe(true)
})
afterEach(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

const plan = (start: string): string[] => tracking.get('work', start).plan.clients ?? []
const task = (title: string, list: string): ReturnType<TasksStore['create']> =>
  tasks.create({ workspace: 'work', title, list })

describe('a list for every client', () => {
  it('exists as soon as a contract has the client, with no task', () => {
    expect(() => task('t', 'Royal Holloway')).toThrow('not a client')
    tracking.createContract('work', '2026-11-20', '2026-12-17', {
      clients: ['Royal Holloway'],
      name: 'RH'
    })
    expect(task('t', 'Royal Holloway').list).toBe('Royal Holloway')
  })
  it('exists as soon as a client is added in Settings', () => {
    expect(() => task('t', 'New one')).toThrow('not a client')
    tracking.setPlan('work', '2026-10-23', { clients: ['Impact', 'New one'] })
    expect(task('t', 'New one').list).toBe('New one')
  })
  it('takes the spelling a client already has, so there is one list', () => {
    tracking.createContract('work', '2026-11-20', '2026-12-17', {
      clients: ['TEACHING'],
      name: 'Three'
    })
    expect(plan('2026-11-20')).toEqual(['Teaching'])
  })
})

describe('adding a client in Settings', () => {
  it('takes the spelling another contract has', () => {
    tracking.setPlan('work', '2026-10-23', { clients: ['impact', 'TEACHING'] })
    expect(plan('2026-10-23')).toEqual(['Impact', 'Teaching'])
  })
})

describe('removing a client', () => {
  it('is refused while its list holds a task, naming the client and the count, and changes nothing', () => {
    task('a', 'Teaching')
    task('b', 'Teaching')
    const result = tracking.setPlan('work', '2026-09-25', { clients: ['Impact'] })
    expect(result).toEqual({
      ok: false,
      reason: 'client-has-tasks',
      detail: { client: 'Teaching', tasks: 2 }
    })
    expect(plan('2026-09-25')).toEqual(['Impact', 'Teaching'])
  })
  it('counts a task in the Trash', () => {
    const t = task('a', 'Teaching')
    tasks.delete(t.uid)
    expect(tracking.setPlan('work', '2026-09-25', { clients: ['Impact'] }).ok).toBe(false)
  })
  it('is allowed when the list is empty', () => {
    expect(tracking.setPlan('work', '2026-09-25', { clients: ['Impact'] }).ok).toBe(true)
    expect(plan('2026-09-25')).toEqual(['Impact'])
  })
  it('is allowed while another contract still has the client (its list stays)', () => {
    task('a', 'Impact')
    expect(tracking.setPlan('work', '2026-09-25', { clients: ['Teaching'] }).ok).toBe(true)
    expect(task('b', 'Impact').list).toBe('Impact')
  })
  it('is not asked of Research, whose lists are free', () => {
    tasks.create({ workspace: 'research', title: 'r', list: 'Impact' })
    expect(tracking.setPlan('research', '2026-09-21', { hoursPerWeek: 600 }).ok).toBe(true)
  })
})

describe('renaming a client', () => {
  beforeEach(() => {
    task('a', 'Impact')
    task('b', 'Impact')
    task('c', 'Teaching')
    tracking.start('work', 'Write', undefined, 'Impact')
    tracking.stop()
  })
  it('renames the list, every task in it, the plan of each contract and the hours', () => {
    expect(tracking.renameClient('work', 'Impact', 'Impact Ltd')).toEqual({ ok: true })
    const lists = (): string[] =>
      db
        .prepare('SELECT list FROM tasks ORDER BY title')
        .all()
        .map((r) => (r as { list: string }).list)
    expect(lists()).toEqual(['Impact Ltd', 'Impact Ltd', 'Teaching'])
    expect(plan('2026-09-25')).toEqual(['Impact Ltd', 'Teaching'])
    expect(plan('2026-10-23')).toEqual(['Impact Ltd'])
    expect(tracking.get('work', '2026-09-25').sessions.map((s) => s.client)).toEqual(['Impact Ltd'])
    expect(task('d', 'Impact Ltd').list).toBe('Impact Ltd')
    expect(() => task('e', 'Impact')).toThrow('not a client')
    expect(moved).toBe(1)
  })
  it('moves the Trash too', () => {
    const t = task('gone', 'Impact')
    tasks.delete(t.uid)
    tracking.renameClient('work', 'Impact', 'Impact Ltd')
    expect(db.prepare('SELECT list FROM tasks WHERE uid = ?').get(t.uid)).toEqual({
      list: 'Impact Ltd'
    })
  })
  it('works for a client with no task', () => {
    expect(tracking.renameClient('work', 'Teaching', 'Teaching & Learning')).toEqual({ ok: true })
    expect(plan('2026-09-25')).toEqual(['Impact', 'Teaching & Learning'])
  })
  it('is refused for a name another client has, an unknown client or a bad name, and changes nothing', () => {
    expect(tracking.renameClient('work', 'Impact', 'teaching')).toEqual({
      ok: false,
      reason: 'client-exists'
    })
    expect(tracking.renameClient('work', 'Nobody', 'X')).toEqual({
      ok: false,
      reason: 'unknown-client'
    })
    expect(tracking.renameClient('work', 'Impact', ' ')).toEqual({ ok: false, reason: 'bad-name' })
    expect(plan('2026-09-25')).toEqual(['Impact', 'Teaching'])
    expect(task('x', 'Impact').list).toBe('Impact')
    expect(moved).toBe(0)
  })
  it('puts the tasks and the contracts already changed back when one cannot be saved', () => {
    const failing = new TrackingStore(dir, {
      starts: () => ['2026-09-21'],
      now: () => ({ date: '2026-09-29', time: '10:00:00' }),
      beforeCommit: (() => {
        let n = 0
        return () => {
          // The second contract's save breaks (the first has been saved by then).
          if (++n === 2) throw new Error('disk full')
        }
      })()
    })
    failing.setClientTasks(createClientTasks(db))
    expect(() => failing.renameClient('work', 'Impact', 'Impact Ltd')).toThrow('disk full')
    expect(plan('2026-09-25')).toEqual(['Impact', 'Teaching'])
    expect(plan('2026-10-23')).toEqual(['Impact'])
    expect(db.prepare('SELECT DISTINCT list FROM tasks ORDER BY list').all()).toEqual([
      { list: 'Impact' },
      { list: 'Teaching' }
    ])
  })
})

describe('a task renamed in Tasks', () => {
  it('renames its hours entries in every contract file, and only those', () => {
    tracking.start('work', 'Old name', 'cc://task/a', 'Impact')
    tracking.stop()
    tracking.start('work', 'Other', 'cc://task/b', 'Impact')
    tracking.stop()
    tracking.relabelTask('cc://task/a', 'New name')
    const labels = tracking.get('work', '2026-09-25').sessions.map((s) => s.label)
    expect(labels).toEqual(['New name', 'Other'])
  })
})
