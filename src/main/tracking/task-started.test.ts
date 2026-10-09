import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tasksMigrations } from '../../modules/tasks/main/migrations'
import { TasksStore } from '../../modules/tasks/main/tasks-store'
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
  tracking.setTaskStarted((uid) => {
    if (tasks.get(uid)?.status === 'todo') tasks.setStatus(uid, 'doing')
  })
})
afterEach(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('starting a timer on a task', () => {
  it('puts a task still to do in progress', () => {
    const t = tasks.create({ workspace: 'research', title: 'Write', list: 'Papers' })
    expect(tracking.start('research', 'Write', t.uid).ok).toBe(true)
    expect(tasks.get(t.uid)?.status).toBe('doing')
  })
  it('leaves a done task done', () => {
    const t = tasks.create({ workspace: 'research', title: 'Write', list: 'Papers' })
    tasks.setStatus(t.uid, 'done')
    tracking.start('research', 'Write', t.uid)
    expect(tasks.get(t.uid)?.status).toBe('done')
  })
  it('does it when a running timer is given its task', () => {
    const t = tasks.create({ workspace: 'research', title: 'Write', list: 'Papers' })
    tracking.start('research', '')
    const running = tracking.running()!
    tracking.assignTask('research', running.year, running.session.id, 'Write', t.uid)
    expect(tasks.get(t.uid)?.status).toBe('doing')
  })
})
