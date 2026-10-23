import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { meetingsMigrations } from '../../meetings/main/migrations'
import { trainingMigrations } from '../../training/main/migrations'
import { tasksMigrations } from './migrations'
import { settleSessionTasks } from './session-sweep'
import {
  guardDelete,
  guardStatus,
  guardUpdate,
  sessionSource,
  unlockedForDue
} from './session-lock'
import { TasksStore } from './tasks-store'

let db: Database.Database
let store: TasksStore

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, [...tasksMigrations, ...meetingsMigrations, ...trainingMigrations])
  store = new TasksStore(db)
})

const series = (): { parent: string; sub: string } => {
  const parent = store.create({ workspace: 'research', title: 'Supervision', list: 'Meetings' })
  const sub = store.create({
    workspace: 'research',
    title: 'Supervision · Oct 10, 2026',
    parentUid: parent.uid,
    ownKind: 'meeting',
    due: '2026-10-10'
  })
  return { parent: parent.uid, sub: sub.uid }
}

describe('a session task', () => {
  it('refuses the changes that are the note’s', () => {
    const { sub } = series()
    for (const changes of [
      { title: 'Other' },
      { due: '2026-11-01' },
      { due: null },
      { recurrence: { every: 1, unit: 'week' as const } }
    ]) {
      expect(() => guardUpdate(db, store, sub, changes)).toThrow(/kept by its meeting/)
    }
    expect(() => guardStatus(db, store, sub)).toThrow()
    expect(() => guardDelete(db, store, sub)).toThrow()
  })
  it('lets priority, tags and notes change, and a value that does not change', () => {
    const { sub } = series()
    expect(() =>
      guardUpdate(db, store, sub, {
        priority: 'high',
        tags: ['x'],
        description: 'notes',
        title: 'Supervision · Oct 10, 2026'
      })
    ).not.toThrow()
  })
  it('is still dated and closed by the sweep', () => {
    const { sub } = series()
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, task, series, date, end_time, content_hash)
       VALUES ('research', 'm1', ?, 'Supervision', '2026-10-12', '11:00', 'h')`
    ).run(sub)
    settleSessionTasks(db, store, { date: '2026-10-17', time: '10:00' })
    expect(store.get(sub)).toMatchObject({ status: 'done', due: '2026-10-12' })
  })
  it('drops out of a bulk date change', () => {
    const { sub } = series()
    const free = store.create({ workspace: 'research', title: 'Free', list: 'Reading' })
    expect(unlockedForDue(db, store, [sub, free.uid])).toEqual([free.uid])
  })
})

describe('a series task', () => {
  it('locks title, list, repeat, delete and any date, but not status or priority', () => {
    const { parent } = series()
    expect(() => guardUpdate(db, store, parent, { title: 'x' })).toThrow()
    expect(() => guardUpdate(db, store, parent, { list: 'Other' })).toThrow()
    expect(() => guardUpdate(db, store, parent, { due: '2026-11-01' })).toThrow()
    expect(() => guardDelete(db, store, parent)).toThrow()
    expect(() => guardUpdate(db, store, parent, { priority: 'high' })).not.toThrow()
    expect(() => guardUpdate(db, store, parent, { due: null })).not.toThrow()
    expect(() => guardStatus(db, store, parent)).not.toThrow()
    expect(store.setStatus(parent, 'done').task.status).toBe('done')
  })
  it('has any due date taken away by the sweep', () => {
    const { parent } = series()
    store.setDue([parent], '2026-12-01')
    const changed = settleSessionTasks(db, store, { date: '2026-10-17', time: '10:00' })
    expect([...changed]).toEqual(['research'])
    expect(store.get(parent)?.due).toBeNull()
  })
})

describe('a task with no session under it', () => {
  it('is free', () => {
    const t = store.create({ workspace: 'research', title: 'Plain', list: 'Reading' })
    const kid = store.create({
      workspace: 'research',
      title: 'Kid',
      parentUid: t.uid
    })
    expect(() => guardUpdate(db, store, t.uid, { title: 'x', due: '2026-11-01' })).not.toThrow()
    expect(() => guardDelete(db, store, kid.uid)).not.toThrow()
    expect(() => guardDelete(db, store, t.uid)).not.toThrow()
  })
})

describe('sessionSource', () => {
  it('finds the meeting and the training that name a task', () => {
    const { sub } = series()
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, task, series, date, content_hash)
       VALUES ('research', 'm1', ?, 'Supervision', '2026-10-12', 'h')`
    ).run(sub)
    expect(sessionSource(db, sub)).toMatchObject({
      kind: 'meeting',
      id: 'm1',
      title: 'Supervision'
    })
    db.prepare(
      `INSERT INTO training (workspace, entry_id, task, self_study_task, date, title, skills, leads, summary, excerpt, has_notes, problems, content_hash)
       VALUES ('research', 't1', 'a', 'b', '2026-10-12', 'Plotly', '[]', '[]', '', '', 0, '[]', 'h')`
    ).run()
    expect(sessionSource(db, 'b')).toMatchObject({ kind: 'training', id: 't1', title: 'Plotly' })
    expect(sessionSource(db, 'nope')).toBeNull()
  })
})
