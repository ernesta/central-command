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
  it('locks title, list, repeat, delete, due date and status, but not priority', () => {
    const { parent } = series()
    expect(() => guardUpdate(db, store, parent, { title: 'x' })).toThrow()
    expect(() => guardUpdate(db, store, parent, { list: 'Other' })).toThrow()
    expect(() => guardUpdate(db, store, parent, { due: '2026-11-01' })).toThrow()
    expect(() => guardUpdate(db, store, parent, { due: null })).toThrow()
    expect(() => guardDelete(db, store, parent)).toThrow()
    expect(() => guardStatus(db, store, parent)).toThrow()
    expect(() => guardUpdate(db, store, parent, { priority: 'high' })).not.toThrow()
  })

  it('is due the day of its latest subtask, at once and after the sweep', () => {
    const { parent, sub } = series()
    expect(store.get(parent)?.due).toBe('2026-10-10')
    const later = store.create({
      workspace: 'research',
      title: 'Supervision · Oct 24, 2026',
      parentUid: parent,
      ownKind: 'meeting',
      due: '2026-10-24'
    })
    expect(store.get(parent)?.due).toBe('2026-10-24')
    store.setDue([later.uid], '2026-10-03')
    expect(store.get(parent)?.due).toBe('2026-10-10')
    store.delete(sub)
    expect(store.get(parent)?.due).toBe('2026-10-03')
    // A date put on it by other means is put right by the sweep.
    db.prepare('UPDATE tasks SET due = ? WHERE uid = ?').run('2026-12-01', parent)
    const changed = settleSessionTasks(db, store, { date: '2026-10-17', time: '10:00' })
    expect([...changed]).toEqual(['research'])
    expect(store.get(parent)?.due).toBe('2026-10-03')
  })

  it('is done once all its subtasks are, and open again when one is added or reopened', () => {
    const { parent, sub } = series()
    expect(store.get(parent)?.status).toBe('todo')
    store.setStatus(sub, 'done')
    expect(store.get(parent)?.status).toBe('done')
    expect(store.get(parent)?.completedAt).not.toBeNull()
    store.setStatus(sub, 'todo')
    expect(store.get(parent)?.status).toBe('doing')
    expect(store.get(parent)?.completedAt).toBeNull()
    store.setStatus(sub, 'done')
    store.create({
      workspace: 'research',
      title: 'Supervision · Nov 7, 2026',
      parentUid: parent,
      ownKind: 'meeting',
      due: '2026-11-07'
    })
    expect(store.get(parent)?.status).toBe('doing')
  })

  it('stays as it is with no subtask left', () => {
    const { parent, sub } = series()
    store.delete(sub)
    expect(store.get(parent)?.due).toBe('2026-10-10')
  })

  it('does not change a task that is no series', () => {
    const t = store.create({ workspace: 'research', title: 'Plain', list: 'Reading' })
    store.create({ workspace: 'research', title: 'Kid', parentUid: t.uid, due: '2026-11-01' })
    expect(store.get(t.uid)?.due).toBeNull()
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

describe('sessionSource of a series task', () => {
  it('names a session under it and the series they belong to', () => {
    const { parent, sub } = series()
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, task, series, date, content_hash)
       VALUES ('research', 'm1', ?, 'Supervision', '2026-10-12', 'h')`
    ).run(sub)
    expect(sessionSource(db, parent)).toMatchObject({
      kind: 'meeting',
      id: 'm1',
      series: 'Supervision'
    })
  })
  it('is null for a task with nothing under it', () => {
    const t = store.create({ workspace: 'research', title: 'Plain', list: 'Reading' })
    expect(sessionSource(db, t.uid)).toBeNull()
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
