import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tasksMigrations } from '../../modules/tasks/main/migrations'
import { putStartedTaskInProgress } from '../../modules/tasks/main/task-started'
import { TasksStore } from '../../modules/tasks/main/tasks-store'
import { taskKey } from '../../modules/tasks/shared/tracked'
import { runMigrations } from '../db/migrate'
import { TrackingStore } from './store'

let dir: string
let db: Database.Database
let tracking: TrackingStore
let tasks: TasksStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-task-started-'))
  db = new Database(':memory:')
  runMigrations(db, tasksMigrations)
  tasks = new TasksStore(db)
  tracking = new TrackingStore(dir, {
    starts: () => ['2026-09-21'],
    now: () => ({ date: '2026-09-29', time: '10:00:00' })
  })
  tracking.setTaskStarted((key) => putStartedTaskInProgress(tasks, key))
})
afterEach(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('starting a timer on a task', () => {
  it('puts a task still to do in progress', () => {
    const t = tasks.create({ workspace: 'research', title: 'Write', list: 'Papers' })
    expect(tracking.start('research', 'Write', taskKey(t.uid)).ok).toBe(true)
    expect(tasks.get(t.uid)?.status).toBe('doing')
  })
  it('leaves a done task done', () => {
    const t = tasks.create({ workspace: 'research', title: 'Write', list: 'Papers' })
    tasks.setStatus(t.uid, 'done')
    tracking.start('research', 'Write', taskKey(t.uid))
    expect(tasks.get(t.uid)?.status).toBe('done')
  })
  it('does it when a running timer is given its task', () => {
    const t = tasks.create({ workspace: 'research', title: 'Write', list: 'Papers' })
    tracking.start('research', '')
    const running = tracking.running()!
    tracking.assignTask('research', running.year, running.session.id, 'Write', taskKey(t.uid))
    expect(tasks.get(t.uid)?.status).toBe('doing')
  })
  it('moves a due date in the past to today', () => {
    const fixed = new TasksStore(db, {
      today: () => '2026-09-29',
      now: () => '2026-09-29T10:00:00Z'
    })
    tracking.setTaskStarted((key) => putStartedTaskInProgress(fixed, key))
    const late = fixed.create({
      workspace: 'research',
      title: 'Late',
      list: 'Papers',
      due: '2026-09-20'
    })
    tracking.start('research', 'Late', taskKey(late.uid))
    expect(fixed.get(late.uid)?.due).toBe('2026-09-29')
    expect(fixed.get(late.uid)?.status).toBe('doing')
  })
  it('moves it even when the task is already in progress, and leaves a later date alone', () => {
    const fixed = new TasksStore(db, {
      today: () => '2026-09-29',
      now: () => '2026-09-29T10:00:00Z'
    })
    tracking.setTaskStarted((key) => putStartedTaskInProgress(fixed, key))
    const doing = fixed.create({
      workspace: 'research',
      title: 'A',
      list: 'Papers',
      due: '2026-09-01'
    })
    fixed.setStatus(doing.uid, 'doing')
    const future = fixed.create({
      workspace: 'research',
      title: 'B',
      list: 'Papers',
      due: '2026-10-05'
    })
    const none = fixed.create({ workspace: 'research', title: 'C', list: 'Papers' })
    for (const t of [doing, future, none]) tracking.start('research', t.title, taskKey(t.uid))
    expect(fixed.get(doing.uid)?.due).toBe('2026-09-29')
    expect(fixed.get(future.uid)?.due).toBe('2026-10-05')
    expect(fixed.get(none.uid)?.due).toBe('2026-09-29')
  })
  it('leaves the due date of a done task alone', () => {
    const fixed = new TasksStore(db, {
      today: () => '2026-09-29',
      now: () => '2026-09-29T10:00:00Z'
    })
    tracking.setTaskStarted((key) => putStartedTaskInProgress(fixed, key))
    const t = fixed.create({
      workspace: 'research',
      title: 'Old',
      list: 'Papers',
      due: '2026-09-01'
    })
    fixed.setStatus(t.uid, 'done')
    tracking.start('research', 'Old', taskKey(t.uid))
    expect(fixed.get(t.uid)?.due).toBe('2026-09-01')
  })
})
