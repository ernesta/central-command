import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { RunningTimer } from '@shared/tracking/api'
import { emptyYear, type TrackingYear } from '@shared/tracking/types'
import { meetingsMigrations } from '../../meetings/main/migrations'
import { tasksMigrations } from '../../tasks/main/migrations'
import { trainingMigrations } from '../../training/main/migrations'
import { addSource } from '../../watch/main/repository'
import { watchMigrations } from '../../watch/main/migrations'
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

const collect = (tracking: TrackingSource = noTracking): ReturnType<typeof collectHomeSummary> =>
  collectHomeSummary({
    db,
    tracking,
    now,
    generatedAt: '2026-10-15T10:30:00.000Z',
    weather: null,
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
      years: () => ['2026-09-21'],
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
    expect(s.hours).toMatchObject({ weekAimMinutes: year.plan.hoursPerWeek })
    expect(s.hours!.weekMinutes).toBeGreaterThanOrEqual(120)
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
