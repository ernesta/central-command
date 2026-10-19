import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { meetingsMigrations } from '../../meetings/main/migrations'
import { trainingMigrations } from '../../training/main/migrations'
import { withLocale } from '@shared/with-locale.testing'
import { pickerOptions, suggestedTasks } from '../../hours/shared/start-picker'
import { sessionTaskUids, settleSessionTasks } from './session-sweep'
import { tasksMigrations } from './migrations'
import { listTasks } from './repository'
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

  it("dates and closes a meeting's own subtask whatever region its title was written in", () => {
    for (const locale of ['en-GB', 'de-DE']) {
      const parent = store.create({ workspace: 'research', title: 'Rastle Lab', list: 'Meetings' })
      const title = withLocale(
        locale,
        () =>
          `Rastle Lab · ${new Date(Date.UTC(2026, 9, 10)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
      )
      const marked = store.create({
        workspace: 'research',
        title,
        parentUid: parent.uid,
        ownKind: 'meeting'
      })
      const unmarked = store.create({ workspace: 'research', title, parentUid: parent.uid })
      meeting(marked.uid, '2026-10-10', '11:00')
      meeting(unmarked.uid, '2026-10-10', '11:00')
      settleSessionTasks(db, store, now)
      expect(store.get(marked.uid)).toMatchObject({ status: 'done', due: '2026-10-10' })
      expect(store.get(unmarked.uid)).toMatchObject({ status: 'done', due: '2026-10-10' })
    }
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

describe('sessionTaskUids: what the timer and Hours do not offer', () => {
  const setup = (): Record<string, string> => {
    const meetings = store.create({ workspace: 'research', title: 'Supervision', list: 'Meetings' })
    const own = store.create({
      workspace: 'research',
      title: 'Supervision · 19 Oct 2026',
      parentUid: meetings.uid,
      ownKind: 'meeting'
    })
    const olderOwn = store.create({
      workspace: 'research',
      title: 'Supervision · Oct 12, 2026',
      parentUid: meetings.uid
    })
    const chosen = store.create({
      workspace: 'research',
      title: 'Prepare supervision slides',
      list: 'Writing'
    })
    const series = store.create({ workspace: 'research', title: 'PS5210', list: 'Training' })
    const lecture = store.create({
      workspace: 'research',
      title: 'Lecture 1',
      parentUid: series.uid,
      ownKind: 'training'
    })
    const study = store.create({
      workspace: 'research',
      title: 'Lecture 1 self-study',
      list: 'Training',
      ownKind: 'self-study'
    })
    const ordinary = store.create({ workspace: 'research', title: 'Read', list: 'Reading' })
    const work = store.create({ workspace: 'work', title: 'Impact meetings', list: 'Impact' })
    const workOwn = store.create({
      workspace: 'work',
      title: 'Impact meetings · 19 Oct 2026',
      parentUid: work.uid,
      ownKind: 'meeting'
    })
    meeting(own.uid, '2026-10-19', null)
    meeting(olderOwn.uid, '2026-10-12', null)
    meeting(chosen.uid, '2026-10-20', null)
    training(lecture.uid, '2026-10-21', null)
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, task, series, date, end_time, content_hash)
       VALUES ('work', 'w', @task, 'Impact', '2026-10-19', NULL, 'h')`
    ).run({ task: workOwn.uid })
    return {
      own: own.uid,
      olderOwn: olderOwn.uid,
      chosen: chosen.uid,
      lecture: lecture.uid,
      study: study.uid,
      ordinary: ordinary.uid,
      series: series.uid,
      meetings: meetings.uid,
      workOwn: workOwn.uid
    }
  }

  it("is the meeting's own tasks (marked or older) and the lectures' own, in their workspace", () => {
    const id = setup()
    expect(new Set(sessionTaskUids(db, store, 'research'))).toEqual(
      new Set([id.own, id.olderOwn, id.lecture])
    )
    expect(sessionTaskUids(db, store, 'work')).toEqual([id.workOwn])
    expect(sessionTaskUids(db, store, 'life')).toEqual([])
  })

  it('leaves out the tasks the picker must still offer: self-study, ordinary, series, and one chosen for a meeting', () => {
    const id = setup()
    const hidden = new Set(sessionTaskUids(db, store, 'research'))
    for (const uid of [id.study, id.ordinary, id.series, id.meetings, id.chosen]) {
      expect(hidden.has(uid)).toBe(false)
    }
  })

  it('takes a session task out of the suggestions and out of typed search, and nothing else', () => {
    const id = setup()
    const hidden = new Set(sessionTaskUids(db, store, 'research'))
    const open = listTasks(db, 'research').filter((t) => !hidden.has(t.uid))
    const year = {
      sessions: ['own', 'olderOwn', 'lecture', 'study', 'ordinary', 'chosen'].map((k, n) => ({
        task: `cc://task/${id[k]}`,
        date: '2026-10-17',
        start: `0${n + 1}:00:00`
      })),
      adjusts: []
    } as never
    const suggested = suggestedTasks(year, open, '2026-10-17', 10).map((t) => t.uid)
    expect(new Set(suggested)).toEqual(new Set([id.study, id.ordinary, id.chosen]))
    expect(new Set(pickerOptions(open, 'supervision').tasks.map((t) => t.uid))).toEqual(
      new Set([id.meetings, id.chosen])
    )
    expect(pickerOptions(open, 'lecture 1').tasks.map((t) => t.uid)).toEqual([id.study])
  })

  it('a task is not hidden once it is not a meeting task any more (unmarked and not titled as one)', () => {
    const id = setup()
    store.update(id.own, { ownKind: null, title: 'Supervision prep' })
    expect(sessionTaskUids(db, store, 'research')).not.toContain(id.own)
  })
})
