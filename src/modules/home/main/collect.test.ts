import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { RunningTimer } from '@shared/tracking/api'
import { emptyYear, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { meetingsMigrations } from '../../meetings/main/migrations'
import { tasksMigrations } from '../../tasks/main/migrations'
import { trainingMigrations } from '../../training/main/migrations'
import { upsertTraining } from '../../training/main/repository'
import type { TrainingIndexRow } from '../../training/shared/types'
import { addSource } from '../../watch/main/repository'
import { watchMigrations } from '../../watch/main/migrations'
import { buildWidgetSnapshot } from '../shared/widget'
import { collectHomeSummary, timerMinutes, type TrackingSource } from './collect'

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, [
    ...tasksMigrations,
    ...meetingsMigrations,
    ...trainingMigrations,
    ...watchMigrations
  ])
})

const now = { date: '2026-10-15', time: '10:30:00' }

const task = (uid: string, over: Record<string, unknown> = {}): void => {
  const t = {
    uid,
    workspace: 'research',
    title: uid,
    status: 'todo',
    priority: 'normal',
    due: '2026-10-15',
    list: 'Reading',
    ...over
  }
  db.prepare(
    `INSERT INTO tasks (uid, workspace, title, status, priority, due, list, created_at, updated_at)
     VALUES (@uid, @workspace, @title, @status, @priority, @due, @list, 'x', 'x')`
  ).run(t)
}

const noTracking: TrackingSource = {
  running: () => null,
  years: () => [],
  get: () => emptyYear('2026-09-21')
}

const collect = (
  tracking: TrackingSource = noTracking,
  yearStarts: readonly string[] = ['2026-09-21']
): ReturnType<typeof collectHomeSummary> =>
  collectHomeSummary({
    db,
    tracking,
    now,
    generatedAt: '2026-10-15T10:30:00.000Z',
    weather: null,
    yearStarts,
    watch: true
  })

describe('collectHomeSummary: tasks', () => {
  it('reads due tasks of both workspaces, not done, trashed or undated ones', () => {
    task('a')
    task('w', { workspace: 'work' })
    task('done', { status: 'done' })
    task('undated', { due: null })
    task('late', { due: '2026-10-01' })
    db.prepare(
      "INSERT INTO tasks (uid, workspace, title, due, list, deleted_at, created_at, updated_at) VALUES ('gone', 'research', 'gone', '2026-10-15', 'L', 'x', 'x', 'x')"
    ).run()
    const s = collect()
    expect(s.tasks.today.map((t) => t.uid).sort()).toEqual(['a', 'w'])
    expect(s.tasks.overdue.map((t) => t.uid)).toEqual(['late'])
  })

  it('leaves out the subtask a meeting or a lecture owns', () => {
    task('own-meeting')
    task('own-lecture')
    task('ordinary')
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, series, date, content_hash, task) VALUES ('research', 'm1', 'Supervision', '2026-10-20', 'h', 'own-meeting')`
    ).run()
    db.prepare(
      `INSERT INTO training (workspace, entry_id, date, title, skills, leads, summary, excerpt, has_notes, problems, content_hash, task)
       VALUES ('research', 't1', '2026-10-21', 'R day', '[]', '[]', '', '', 0, '[]', 'h', 'own-lecture')`
    ).run()
    const s = collect()
    expect(s.tasks.today.map((t) => t.uid)).toEqual(['ordinary'])
    expect(s.upcoming.map((e) => [e.kind, e.title])).toEqual([
      ['meeting', 'Supervision'],
      ['training', 'R day']
    ])
  })

  it('keeps a task whose training marker is only "auto"', () => {
    task('auto-task')
    db.prepare(
      `INSERT INTO training (workspace, entry_id, date, title, skills, leads, summary, excerpt, has_notes, problems, content_hash, task)
       VALUES ('research', 't2', '2026-10-21', 'X', '[]', '[]', '', '', 0, '[]', 'h', 'auto')`
    ).run()
    expect(collect().tasks.today.map((t) => t.uid)).toEqual(['auto-task'])
  })
})

describe('collectHomeSummary: meetings and todos', () => {
  it('finds the next meeting and counts open inline TODOs of past and present meetings', () => {
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, series, date, start_time, content_hash) VALUES ('research', 'old', 'Supervision', '2026-10-08', '10:00', 'h')`
    ).run()
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, series, date, start_time, content_hash) VALUES ('research', 'next', 'Supervision', '2026-10-22', '10:00', 'h')`
    ).run()
    const old = (
      db.prepare("SELECT id FROM meetings WHERE meeting_id = 'old'").get() as { id: number }
    ).id
    const insert = db.prepare(
      'INSERT INTO meeting_todos (meeting_pk, position, kind, text, done) VALUES (?, ?, ?, ?, ?)'
    )
    insert.run(old, 0, 'inline', 'open one', 0)
    insert.run(old, 1, 'inline', 'done one', 1)
    insert.run(old, 2, 'previous', 'carried over', 0)
    const s = collect()
    expect(s.meetings.next?.id).toBe('next')
    expect(s.meetings.openTodos).toBe(1)
  })
})

describe('collectHomeSummary: tracking', () => {
  const runner = (over: Partial<RunningTimer['session']> = {}): RunningTimer => ({
    workspace: 'research',
    year: '2026-09-21',
    session: {
      id: 's',
      date: '2026-10-15',
      start: '09:00:00',
      end: null,
      label: 'Reading',
      ...over
    }
  })

  it('shows the running timer in whole minutes, and Research hours against the weekly aim', () => {
    const year: TrackingYear = {
      ...emptyYear('2026-09-21'),
      sessions: [
        {
          id: 'a',
          date: '2026-10-14',
          start: '09:00:00',
          end: '11:00:00',
          minutes: 120,
          label: 'Reading'
        }
      ],
      timeOff: [
        { date: '2026-10-12', type: 'leave' },
        { date: '2026-10-19', type: 'leave' }
      ]
    }
    const tracking: TrackingSource = {
      running: () => runner(),
      years: (ws) => (ws === 'research' ? ['2026-09-21'] : []),
      get: () => year
    }
    const s = collect(tracking)
    expect(s.timer).toEqual({
      workspace: 'research',
      label: 'Reading',
      date: '2026-10-15',
      time: '09:00',
      minutes: 90
    })
    expect(s.hours.research).toMatchObject({
      label: 'This week',
      // the week's aim as the Hours page has it: a day of leave (12 Oct) takes its share off the plan's 37:30
      aimMinutes: 1800
    })
    expect(s.hours.research!.minutes).toBeGreaterThanOrEqual(120)
    expect(s.hours.work).toBeNull()
    expect(s.upcoming.filter((e) => e.kind === 'time-off').map((e) => e.date)).toEqual([
      '2026-10-19'
    ])
  })

  it('counts a timer across midnight', () => {
    expect(
      timerMinutes(runner({ date: '2026-10-14', start: '23:30:00' }), {
        date: '2026-10-15',
        time: '00:15:00'
      })
    ).toBe(45)
    expect(
      timerMinutes(runner({ date: '2026-10-14', start: '23:30:00' }), {
        date: '2026-10-14',
        time: '25:00:00'
      })
    ).toBe(90)
  })
})

describe('collectHomeSummary: watch', () => {
  it('has no Watch brief until a source exists', () => {
    expect(collect().watch).toBeNull()
    addSource(
      db,
      { title: 'S', url: 'https://ex.org/f', kind: 'conference', method: 'feed' },
      'now'
    )
    expect(collect().watch?.counts.sources).toBe(1)
  })
})

describe('collectHomeSummary: hours are the Hours page’s hours', () => {
  // Thursday 15 Oct 2026, in Research's year that starts Monday 21 Sep 2026 (the settings' start) and Work's contract from 14 Sep.
  const insertMeeting = (
    w: string,
    id: string,
    task: string,
    over: Record<string, unknown> = {}
  ): void => {
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, series, date, start_time, end_time, content_hash, task)
       VALUES (@workspace, @id, 'Supervision', @date, @start, @end, 'h', @task)`
    ).run({ workspace: w, id, task, date: '2026-10-14', start: '14:00', end: '15:00', ...over })
  }
  const insertLecture = (id: string, task: string, over: Partial<TrainingIndexRow> = {}): void =>
    upsertTraining(db, {
      workspace: 'research',
      id,
      date: '2026-10-13',
      start: '10:00',
      end: '11:30',
      title: 'Plotly',
      series: 'PS5210',
      type: null,
      mode: null,
      skills: [],
      leads: [],
      institution: null,
      folder: null,
      task,
      selfStudy: '',
      summary: '',
      excerpt: '',
      hasNotes: false,
      problems: [],
      contentHash: 'h',
      ...over
    })
  const research: TrackingYear = {
    ...emptyYear('2026-09-21'),
    adjusts: [{ id: 'a', date: '2026-10-15', label: 'Reading', minutes: 30 }]
  }
  const work: TrackingYear = {
    ...emptyYear('2026-09-14', { ...WORK_PLAN, clients: ['Impact', 'Luminos'] }),
    adjusts: [{ id: 'w', date: '2026-10-12', label: 'Proposal', minutes: 45, client: 'Impact' }]
  }
  const source = (years: Record<string, TrackingYear>): TrackingSource => ({
    running: () => null,
    years: (ws) => (years[ws] ? [years[ws].start] : []),
    get: (ws) => years[ws]
  })
  const hours = (years: Record<string, TrackingYear>): ReturnType<typeof collect>['hours'] =>
    collect(source(years)).hours

  it('counts a meeting and a lecture that have a task and times, as the Hours page does', () => {
    task('m1', { due: null, title: 'Supervision' })
    task('l1', { due: null, title: 'Plotly' })
    insertMeeting('research', 'm', 'm1')
    insertLecture('l', 'l1')
    const h = hours({ research })
    expect(h.research?.minutes).toBe(30 + 60 + 90)
    expect(h.research?.todayMinutes).toBe(30)
    expect(h.research?.label).toBe('This week')
  })

  it('leaves out what the page leaves out: no task, a task that is gone, no end, a future date', () => {
    task('m1', { due: null })
    insertMeeting('research', 'untasked', '')
    insertMeeting('research', 'gone', 'nope')
    insertMeeting('research', 'noend', 'm1', { end: null })
    insertMeeting('research', 'future', 'm1', { date: '2026-10-16' })
    insertLecture('autoonly', 'auto')
    expect(hours({ research }).research?.minutes).toBe(30)
  })

  it('counts a typed entry and a meeting on the same task and day once (history linked later)', () => {
    task('m1', { due: null })
    insertMeeting('research', 'm', 'm1')
    const linked: TrackingYear = {
      ...research,
      adjusts: [
        ...research.adjusts,
        {
          id: 'e',
          date: '2026-10-14',
          label: 'Supervision',
          minutes: 60,
          task: 'cc://task/m1',
          earlier: true
        }
      ]
    }
    expect(hours({ research: linked }).research?.minutes).toBe(30 + 60)
  })

  it('a time tracked on the lecture’s self-study task and its session both count', () => {
    task('l1', { due: null })
    insertLecture('l', 'l1')
    const studied: TrackingYear = {
      ...research,
      adjusts: [
        ...research.adjusts,
        {
          id: 's',
          date: '2026-10-13',
          label: 'Plotly · self-study',
          minutes: 45,
          task: 'cc://task/s1'
        }
      ]
    }
    expect(hours({ research: studied }).research?.minutes).toBe(30 + 90 + 45)
  })

  it('Work: a meeting under a client’s list lands in the month and under the client', () => {
    task('p', { workspace: 'work', list: 'Impact', due: null })
    task('m1', { workspace: 'work', list: '', due: null })
    db.prepare("UPDATE tasks SET parent_uid = 'p' WHERE uid = 'm1'").run()
    insertMeeting('work', 'wm', 'm1', { date: '2026-10-13' })
    const h = hours({ research, work }).work
    expect(h?.label).toBe('This month')
    expect(h?.minutes).toBe(45 + 60)
    expect(h?.clients).toEqual([{ client: 'Impact', minutes: 105 }])
  })

  it('a year that does not hold today gives nothing, not the newest year’s hours', () => {
    const old: TrackingYear = { ...research, start: '2025-09-15' }
    expect(hours({ research: old }).research).toBeNull()
    expect(hours({}).research).toBeNull()
    expect(hours({}).work).toBeNull()
  })

  it('the widget file carries the same numbers as the summary', () => {
    task('m1', { due: null })
    insertMeeting('research', 'm', 'm1')
    const summary = collect(source({ research, work }))
    const snapshot = buildWidgetSnapshot(summary)
    expect(snapshot.week).toEqual(summary.hours.research)
    expect(snapshot.work).toEqual(summary.hours.work)
    expect(snapshot.week?.minutes).toBe(90)
  })

  it('takes the year of the settings that holds today, not the newest file', () => {
    const next: TrackingYear = {
      ...emptyYear('2027-09-20'),
      adjusts: [{ id: 'n', date: '2027-09-21', label: 'Later', minutes: 500 }]
    }
    const tracking: TrackingSource = {
      running: () => null,
      years: (ws) => (ws === 'research' ? ['2027-09-20', '2026-09-21'] : []),
      get: (_ws, start) => (start === '2027-09-20' ? next : research)
    }
    const h = collect(tracking, ['2026-09-21', '2027-09-20']).hours
    expect(h.research?.minutes).toBe(30)
  })

  it('a finished year that is the newest listed gives nothing, since today is outside it', () => {
    const finished: TrackingYear = { ...emptyYear('2025-09-22'), adjusts: research.adjusts }
    const tracking: TrackingSource = {
      running: () => null,
      years: (ws) => (ws === 'research' ? ['2025-09-22'] : []),
      get: () => finished
    }
    expect(collect(tracking, ['2025-09-22']).hours.research).toBeNull()
  })

  it('a Work contract that has ended gives nothing: the page opens on it, but today is not in it', () => {
    const ended: TrackingYear = { ...work, start: '2026-01-05', weeks: 4 }
    expect(hours({ research, work: ended }).work).toBeNull()
  })

  it('reads and writes nothing: the notes, tasks and years are as they were', () => {
    task('m1', { due: null })
    insertMeeting('research', 'm', 'm1')
    const before = JSON.stringify(research)
    const tasksBefore = db.prepare('SELECT * FROM tasks').all()
    hours({ research })
    expect(JSON.stringify(research)).toBe(before)
    expect(db.prepare('SELECT * FROM tasks').all()).toEqual(tasksBefore)
  })
})
