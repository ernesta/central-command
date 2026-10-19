import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { withLocale } from '@shared/with-locale.testing'
import { runMigrations } from '../../../main/db/migrate'
import { meetingsMigrations } from '../../meetings/main/migrations'
import { trainingMigrations } from '../../training/main/migrations'
import { tasksMigrations } from './migrations'
import { applyRepair, formatRepairReport, planRepair, readRepairInput } from './session-repair'
import { TasksStore } from './tasks-store'

let db: Database.Database
let store: TasksStore
const NONE = new Map<string, number>()

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, [...tasksMigrations, ...meetingsMigrations, ...trainingMigrations])
  store = new TasksStore(db)
})

const meeting = (
  id: string,
  task: string,
  series: string,
  date: string,
  workspace = 'research'
): void => {
  db.prepare(
    `INSERT INTO meetings (workspace, meeting_id, task, series, date, content_hash)
     VALUES (?, ?, ?, ?, ?, 'h')`
  ).run(workspace, id, task, series, date)
}
const training = (id: string, over: Record<string, string | null> = {}): void => {
  const row = {
    id,
    title: 'Training 1',
    series: 'PS5210',
    date: '2026-10-21',
    end: null,
    task: '',
    selfStudy: '',
    ...over
  }
  db.prepare(
    `INSERT INTO training (workspace, entry_id, task, self_study_task, date, end_time, title, series, skills, leads, summary, excerpt, has_notes, problems, content_hash)
     VALUES ('research', @id, @task, @selfStudy, @date, @end, @title, @series, '[]', '[]', '', '', 0, '[]', 'h')`
  ).run(row)
}

/** The library as the user found it on 19 Oct 2026: three tasks left behind, a meeting changed to Other with its task not following. */
function scenario(): Record<string, string> {
  const supervision = store.create({
    workspace: 'research',
    title: 'Supervision',
    list: 'Meetings'
  })
  const meetings = store.create({ workspace: 'research', title: 'Meetings', list: 'Meetings' })
  const sub = (title: string, parentUid: string, due: string | null = null): string =>
    store.create({ workspace: 'research', title, parentUid, due }).uid
  const left = [1, 2, 3].map(() => sub('Supervision · 19 Oct 2026', supervision.uid, '2026-10-19'))
  const stale = sub('Supervision · 19 Oct 2026', supervision.uid, '2026-10-19')
  const inStep = sub('Supervision · 12 Oct 2026', supervision.uid, '2026-10-12')
  const marked = store.create({
    workspace: 'research',
    title: 'Supervision · 5 Oct 2026',
    parentUid: supervision.uid,
    due: '2026-10-05',
    ownKind: 'meeting'
  }).uid
  const chosen = store.create({
    workspace: 'research',
    title: 'Write the plan',
    list: 'Writing'
  }).uid
  const trashed = sub('Supervision · 1 Oct 2026', supervision.uid)
  store.delete(trashed)
  const shared = sub('Supervision · 2 Oct 2026', supervision.uid, '2026-10-02')
  meeting('2026-10-20 Other', stale, 'Other', '2026-10-20')
  meeting('2026-10-12 Supervision', inStep, 'Supervision', '2026-10-12')
  meeting('2026-10-05 Supervision', marked, 'Supervision', '2026-10-05')
  meeting('2026-09-01 Luminos', chosen, 'Luminos', '2026-09-01')
  meeting('2026-10-01 Supervision', trashed, 'Supervision', '2026-10-01')
  meeting('2026-10-02 Supervision', shared, 'Supervision', '2026-10-02')
  meeting('2026-10-02 Supervision 2', shared, 'Supervision', '2026-10-02')
  meeting('2026-10-21 Untitled', 'auto', '', '2026-10-21')
  meeting('2026-10-03 Supervision', 'nope0001', 'Supervision', '2026-10-03')
  meeting('2026-10-04 Supervision', '', 'Supervision', '2026-10-04')
  return {
    supervision: supervision.uid,
    meetings: meetings.uid,
    stale,
    inStep,
    marked,
    chosen,
    shared,
    left0: left[0]
  }
}

describe('planRepair: meetings', () => {
  it('finds the meeting changed to Other whose task still says Supervision, and says how to fix it', () => {
    const id = scenario()
    const report = planRepair(readRepairInput(db), null, NONE)
    const other = report.meetings.find((m) => m.id === '2026-10-20 Other')
    expect(other?.fix).toMatchObject({
      uid: id.stale,
      mark: 'meeting',
      title: withLocale('en-US', () => 'Meetings · Oct 20, 2026'),
      due: '2026-10-20',
      parent: { uid: id.meetings }
    })
    expect(other?.markerMissing).toBe(true)
  })

  it('classifies every meeting: in step, marker missing, chosen, in the trash, missing, auto, none', () => {
    scenario()
    const report = planRepair(readRepairInput(db), null, NONE)
    const state = (id: string): string | undefined =>
      report.meetings.find((m) => m.id === id)?.state
    expect(state('2026-10-12 Supervision')).toBe('own')
    expect(state('2026-10-05 Supervision')).toBe('own')
    expect(state('2026-09-01 Luminos')).toBe('chosen')
    expect(state('2026-10-01 Supervision')).toBe('in-trash')
    expect(state('2026-10-03 Supervision')).toBe('missing')
    expect(state('2026-10-21 Untitled')).toBe('auto')
    expect(report.meetings.find((m) => m.id === '2026-10-04 Supervision')).toBeUndefined()
    const inStep = report.meetings.find((m) => m.id === '2026-10-12 Supervision')
    expect(inStep?.markerMissing).toBe(true)
    expect(inStep?.fix).toEqual(expect.objectContaining({ mark: 'meeting' }))
    const marked = report.meetings.find((m) => m.id === '2026-10-05 Supervision')
    expect(marked?.markerMissing).toBe(false)
  })

  it('lists two meetings that share a task, and never proposes touching a chosen task', () => {
    scenario()
    const report = planRepair(readRepairInput(db), null, NONE)
    const shared = report.meetings.filter((m) => m.sharedWith.length > 0)
    expect(shared.map((m) => m.id).sort()).toEqual([
      '2026-10-02 Supervision',
      '2026-10-02 Supervision 2'
    ])
    expect(report.meetings.find((m) => m.state === 'chosen')?.fix).toBeNull()
  })
})

describe('planRepair: orphans', () => {
  it('lists the own-looking subtasks no meeting names, with their tracked time, and not the ones that are named', () => {
    const id = scenario()
    const tracked = new Map([[id.left0, 90]])
    const report = planRepair(readRepairInput(db), null, tracked)
    const orphans = report.orphans.filter((o) => o.title === 'Supervision · 19 Oct 2026')
    expect(orphans).toHaveLength(3)
    expect(orphans.every((o) => o.list === 'Meetings' && o.parentTitle === 'Supervision')).toBe(
      true
    )
    expect(orphans.find((o) => o.uid === id.left0)?.trackedMinutes).toBe(90)
    expect(report.orphans.map((o) => o.uid)).not.toContain(id.stale)
    const text = formatRepairReport(report, 'test')
    expect(text).toContain('"Supervision · 19 Oct 2026" in Meetings, pointed at by no meeting: 3')
    expect(text).toContain('KEEP: has time in Hours')
    expect(text).toContain('would be trashed')
    expect(text).toContain('CHECK "Other · 20 Oct 2026"')
  })

  it('proposes nothing for a trash: the script has no delete', () => {
    scenario()
    const report = planRepair(readRepairInput(db), null, NONE)
    expect(JSON.stringify(report)).not.toMatch(/"delete"/)
  })
})

describe('planRepair: trainings are left alone', () => {
  it('reports nothing about trainings, and never counts a task a training names as an orphan', () => {
    const series = store.create({ workspace: 'research', title: 'PS5210', list: 'Training' })
    const study = store.create({
      workspace: 'research',
      title: 'Training 4 self-study',
      parentUid: series.uid
    })
    training('a', { selfStudy: study.uid })
    const report = planRepair(readRepairInput(db), null, NONE)
    expect(Object.keys(report).sort()).toEqual(['meetings', 'orphans'])
    expect(formatRepairReport(report, 'test')).not.toMatch(/TRAINING/i)
  })
})

describe('applyRepair', () => {
  it('marks, renames, dates and re-parents, trashes the orphans with no time, and leaves the chosen task, and a second look finds nothing', () => {
    const id = scenario()
    const done = applyRepair(db, null, NONE)
    expect(done.marked).toBeGreaterThan(0)
    expect(done.trashed).toBe(3)
    const other = store.get(id.stale)
    expect(other).toMatchObject({ due: '2026-10-20', parentUid: id.meetings, ownKind: 'meeting' })
    expect(store.get(id.chosen)).toMatchObject({ title: 'Write the plan', ownKind: null })
    expect(store.get(id.left0)).toBeNull()
    const after = planRepair(readRepairInput(db), null, NONE)
    expect(after.meetings.filter((m) => m.fix)).toEqual([])
    expect(applyRepair(db, null, NONE)).toEqual({ marked: 0, changed: 0, trashed: 0 })
  })

  it('keeps an orphan that has time tracked on it', () => {
    const id = scenario()
    const done = applyRepair(db, null, new Map([[id.left0, 90]]))
    expect(done.trashed).toBe(2)
    expect(store.get(id.left0)).not.toBeNull()
  })

  it('writes nothing at all when the result does not verify', () => {
    const id = scenario()
    // A trigger that undoes every title change makes the second look find the same work still to do.
    db.exec(
      `CREATE TRIGGER keep_title BEFORE UPDATE OF title ON tasks BEGIN SELECT RAISE(IGNORE); END`
    )
    const snapshot = JSON.stringify(readRepairInput(db).tasks)
    expect(() => applyRepair(db, null, NONE)).toThrow(/Refusing to write/)
    expect(JSON.stringify(readRepairInput(db).tasks)).toBe(snapshot)
    expect(store.get(id.stale)?.ownKind).toBeNull()
  })
})
