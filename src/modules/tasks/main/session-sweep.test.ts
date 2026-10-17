import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { meetingsMigrations } from '../../meetings/main/migrations'
import { trainingMigrations } from '../../training/main/migrations'
import { settleSessionTasks } from './session-sweep'
import { tasksMigrations } from './migrations'
import { TasksStore } from './tasks-store'

let db: Database.Database
let store: TasksStore

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, [...tasksMigrations, ...meetingsMigrations, ...trainingMigrations])
  store = new TasksStore(db)
})

const meeting = (task: string, date: string, end: string | null): void => {
  db.prepare(
    `INSERT INTO meetings (workspace, meeting_id, task, series, date, end_time, content_hash)
     VALUES ('research', @id, @task, 'Rastle Lab', @date, @end, 'h')`
  ).run({ id: `${date} ${task}`, task, date, end })
}
const training = (task: string, date: string, end: string | null): void => {
  db.prepare(
    `INSERT INTO training (workspace, entry_id, task, date, end_time, title, skills, leads, summary, excerpt, has_notes, problems, content_hash)
     VALUES ('research', @id, @task, @date, @end, 'T', '[]', '[]', '', '', 0, '[]', 'h')`
  ).run({ id: `${date} ${task}`, task, date, end })
}
const now = { date: '2026-10-17', time: '10:00' }

describe('settleSessionTasks', () => {
  it("dates and closes a past meeting's own subtask, and leaves the series task alone", () => {
    const parent = store.create({ workspace: 'research', title: 'Rastle Lab', list: 'Meetings' })
    const sub = store.create({
      workspace: 'research',
      title: 'Rastle Lab · Oct 10, 2026',
      parentUid: parent.uid,
      status: 'doing'
    })
    meeting(sub.uid, '2026-10-10', '11:00')
    expect([...settleSessionTasks(db, store, now)]).toEqual(['research'])
    expect(store.get(sub.uid)).toMatchObject({ status: 'done', due: '2026-10-10' })
    expect(store.get(parent.uid)).toMatchObject({ status: 'todo', due: null })
    expect(settleSessionTasks(db, store, now).size).toBe(0)
  })

  it('does not close a session that has not ended, but dates it', () => {
    const parent = store.create({ workspace: 'research', title: 'Rastle Lab', list: 'Meetings' })
    const sub = store.create({
      workspace: 'research',
      title: 'Rastle Lab · Oct 17, 2026',
      parentUid: parent.uid,
      status: 'doing'
    })
    meeting(sub.uid, '2026-10-17', '11:00')
    settleSessionTasks(db, store, now)
    expect(store.get(sub.uid)).toMatchObject({ status: 'doing', due: '2026-10-17' })
    settleSessionTasks(db, store, { date: '2026-10-17', time: '11:00' })
    expect(store.get(sub.uid)?.status).toBe('done')
  })

  it('never touches a task the user chose for a meeting', () => {
    const chosen = store.create({ workspace: 'research', title: 'Write paper', list: 'Study 1' })
    meeting(chosen.uid, '2026-10-10', '11:00')
    settleSessionTasks(db, store, now)
    expect(store.get(chosen.uid)).toMatchObject({ status: 'todo', due: null })
  })

  it("closes a training's own top-level task in Training, but not one with subtasks or in another list", () => {
    const own = store.create({ workspace: 'research', title: 'Day 1', list: 'Training' })
    const series = store.create({ workspace: 'research', title: 'Course', list: 'Training' })
    store.create({ workspace: 'research', title: 'Day 1 of course', parentUid: series.uid })
    const elsewhere = store.create({ workspace: 'research', title: 'Other', list: 'Reading' })
    training(own.uid, '2026-10-09', null)
    training(series.uid, '2026-10-09', null)
    training(elsewhere.uid, '2026-10-09', null)
    settleSessionTasks(db, store, now)
    expect(store.get(own.uid)).toMatchObject({ status: 'done', due: '2026-10-09' })
    expect(store.get(series.uid)?.status).toBe('todo')
    expect(store.get(elsewhere.uid)?.status).toBe('todo')
  })

  it('ignores a note still marked auto or without a task', () => {
    meeting('auto', '2026-10-10', '11:00')
    training('', '2026-10-10', '11:00')
    expect(settleSessionTasks(db, store, now).size).toBe(0)
  })
})
