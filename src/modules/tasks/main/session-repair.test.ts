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
    title: 'Supervision meetings',
    list: 'Meetings'
  })
  const meetings = store.create({
    workspace: 'research',
    title: 'Other meetings',
    list: 'Meetings'
  })
  const sub = (title: string, parentUid: string, due: string | null = null): string =>
    store.create({ workspace: 'research', title, parentUid, due }).uid
  const left = [1, 2, 3].map(() => sub('Supervision · 19 Oct 2026', supervision.uid, '2026-10-19'))
  const stale = sub('Supervision · 19 Oct 2026', supervision.uid, '2026-10-19')
  const inStep = sub('Supervision meetings · 12 Oct 2026', supervision.uid, '2026-10-12')
  const marked = store.create({
    workspace: 'research',
    title: 'Supervision meetings · 5 Oct 2026',
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
      title: withLocale('en-US', () => 'Other meetings · Oct 20, 2026'),
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
    expect(
      orphans.every((o) => o.list === 'Meetings' && o.parentTitle === 'Supervision meetings')
    ).toBe(true)
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

describe('planRepair: trainings', () => {
  /** The real shape of PS5210: a series task in Training with unmarked subtasks the notes name, 24 of them in the library. */
  function ps5210(): {
    series: string
    intro: string
    fnirs: string
    plain: string
    study: string
  } {
    const series = store.create({
      workspace: 'research',
      title: 'PS5210 Applied Neuroscience Methods',
      list: 'Training'
    })
    const intro = store.create({
      workspace: 'research',
      title: 'Introduction',
      parentUid: series.uid,
      due: '2026-09-30',
      status: 'done'
    })
    const fnirs = store.create({
      workspace: 'research',
      title: 'fNIRS',
      parentUid: series.uid,
      due: '2026-10-07'
    })
    const plain = store.create({ workspace: 'research', title: 'DataCamp: R', list: 'Reading' })
    const study = store.create({
      workspace: 'research',
      title: 'Day 2 self-study',
      parentUid: series.uid
    })
    return {
      series: series.uid,
      intro: intro.uid,
      fnirs: fnirs.uid,
      plain: plain.uid,
      study: study.uid
    }
  }

  it('marks the subtasks the notes name, leaves a task you chose, and lists the notes with no task', () => {
    const id = ps5210()
    training('intro', { task: id.intro, title: 'Introduction' })
    training('fnirs', { task: id.fnirs, selfStudy: id.study, title: 'fNIRS' })
    training('datacamp', { task: id.plain, title: 'DataCamp: R' })
    training('gone', { task: 'zzzzzzzz', title: 'Gone' })
    training('none', { task: '', title: 'No task' })
    const report = planRepair(readRepairInput(db), null, NONE)
    const state = (note: string, kind: string): string | undefined =>
      report.trainings.find((t) => t.id === note && t.kind === kind)?.state
    expect(state('intro', 'training')).toBe('mark')
    expect(state('fnirs', 'training')).toBe('mark')
    expect(state('fnirs', 'self-study')).toBe('mark')
    expect(state('datacamp', 'training')).toBe('chosen')
    expect(state('gone', 'training')).toBe('missing')
    expect(report.noTask.map((n) => n.id)).toEqual(['none'])
    const text = formatRepairReport(report, 'test')
    expect(text).toContain('would be marked 3')
    expect(text).toContain('under "PS5210 Applied Neuroscience Methods" → mark as training')
    expect(text).toContain('does not exist')
  })

  it('leaves a task two notes name, and one in the trash', () => {
    const id = ps5210()
    training('a', { task: id.intro })
    training('b', { task: id.intro })
    store.delete(id.fnirs)
    training('c', { task: id.fnirs })
    const report = planRepair(readRepairInput(db), null, NONE)
    expect(report.trainings.filter((t) => t.state === 'shared')).toHaveLength(2)
    expect(report.trainings.find((t) => t.id === 'c')?.state).toBe('in-trash')
  })

  it('never counts a task a training names as an orphan', () => {
    const id = ps5210()
    training('a', { selfStudy: id.study })
    expect(planRepair(readRepairInput(db), null, NONE).orphans).toEqual([])
  })

  it('says how the series task would change, as if the markers were on', () => {
    const id = ps5210()
    training('intro', { task: id.intro })
    training('fnirs', { task: id.fnirs })
    const report = planRepair(readRepairInput(db), null, NONE)
    // Introduction is done, fNIRS open: the series takes the later date and stays open.
    expect(report.series).toMatchObject([{ uid: id.series, due: null, newDue: '2026-10-07' }])
  })
})

describe('planRepair and applyRepair: self-study subtasks', () => {
  /** A `<series> self-study` task with subtasks named the old way, each named by a training note. */
  function studies(): { series: string; a: string; b: string; c: string } {
    const series = store.create({
      workspace: 'research',
      title: 'PS5210 self-study',
      list: 'Training'
    })
    const kid = (title: string, due: string | null = null): string =>
      store.create({
        workspace: 'research',
        title,
        parentUid: series.uid,
        due,
        ownKind: 'self-study'
      }).uid
    const a = kid('Introduction self-study', '2026-10-01')
    const b = kid('fNIRS · self-study', '2026-10-08')
    const c = kid('Day 2', '2026-10-10')
    training('a', { selfStudy: a, title: 'Introduction', date: '2026-10-01' })
    training('b', { selfStudy: b, title: 'fNIRS', date: '2026-10-08' })
    training('c', { selfStudy: c, title: 'Day 2', date: '2026-10-08' })
    return { series: series.uid, a, b, c }
  }

  it('renames to the training alone (both endings) and moves the date to a week after the training', () => {
    const id = studies()
    const report = planRepair(readRepairInput(db), null, NONE)
    const line = (uid: string): unknown => report.selfStudy.find((l) => l.uid === uid)
    expect(line(id.a)).toMatchObject({ newTitle: 'Introduction', newDue: '2026-10-08' })
    expect(line(id.b)).toMatchObject({ newTitle: 'fNIRS', newDue: '2026-10-15' })
    // Already named the new way: only the date moves.
    expect(line(id.c)).toMatchObject({ newDue: '2026-10-15' })
    expect(line(id.c)).not.toHaveProperty('newTitle')
    const text = formatRepairReport(report, 'test')
    expect(text).toContain('rename 2, move the due date 3')
    expect(text).toContain('rename to "Introduction"')
  })

  it('lists a title that is already taken under the same series task and leaves it alone', () => {
    const id = studies()
    store.update(id.c, { title: 'Introduction' })
    const report = planRepair(readRepairInput(db), null, NONE)
    expect(report.selfStudy.find((l) => l.uid === id.a)).toMatchObject({
      collidesWith: 'Introduction'
    })
    expect(report.selfStudy.find((l) => l.uid === id.a)).not.toHaveProperty('newTitle')
    applyRepair(db, null, NONE)
    expect(store.get(id.a)?.title).toBe('Introduction self-study')
    expect(store.get(id.a)?.due).toBe('2026-10-08')
    expect(store.get(id.b)?.title).toBe('fNIRS')
    expect(formatRepairReport(planRepair(readRepairInput(db), null, NONE), 'test')).toContain(
      'name already taken (left alone) 1'
    )
  })

  it('leaves a top-level `<title> self-study` task and one under a task that is not a series task', () => {
    const alone = store.create({
      workspace: 'research',
      title: 'Plotly self-study',
      list: 'Training'
    })
    const parent = store.create({ workspace: 'research', title: 'Taxes', list: 'Money' })
    const stray = store.create({
      workspace: 'research',
      title: 'File it self-study',
      parentUid: parent.uid
    })
    training('a', { selfStudy: alone.uid, date: '2026-10-01' })
    training('b', { selfStudy: stray.uid, date: '2026-10-01' })
    expect(planRepair(readRepairInput(db), null, NONE).selfStudy).toEqual([])
  })

  it('applies the renames and dates, the series follows, and a second run changes nothing', () => {
    const id = studies()
    const done = applyRepair(db, null, NONE)
    expect(done.changed).toBeGreaterThanOrEqual(3)
    expect(store.get(id.a)).toMatchObject({ title: 'Introduction', due: '2026-10-08' })
    expect(store.get(id.b)).toMatchObject({ title: 'fNIRS', due: '2026-10-15' })
    expect(store.get(id.series)?.due).toBe('2026-10-15')
    expect(applyRepair(db, null, NONE)).toEqual({ marked: 0, changed: 0, trashed: 0 })
    expect(planRepair(readRepairInput(db), null, NONE).selfStudy).toEqual([])
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

  it('marks the training tasks, locks them, and brings the series in step; a second run changes nothing', () => {
    const series = store.create({ workspace: 'research', title: 'PS5210', list: 'Training' })
    const kid = (title: string, due: string, status: 'done' | 'todo'): string =>
      store.create({ workspace: 'research', title, parentUid: series.uid, due, status }).uid
    const a = kid('Introduction', '2026-09-30', 'done')
    const b = kid('fNIRS', '2026-10-07', 'done')
    training('a', { task: a })
    training('b', { task: b })
    const done = applyRepair(db, null, NONE)
    expect(done.marked).toBe(2)
    expect(store.get(a)?.ownKind).toBe('training')
    expect(store.get(series.uid)).toMatchObject({ due: '2026-10-07', status: 'done' })
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
