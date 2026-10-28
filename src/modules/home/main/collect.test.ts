import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { RunningTimer } from '@shared/tracking/api'
import { emptyYear, LIFE_PLAN, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { meetingsMigrations } from '../../meetings/main/migrations'
import { tasksMigrations } from '../../tasks/main/migrations'
import { trainingMigrations } from '../../training/main/migrations'
import { upsertTraining } from '../../training/main/repository'
import type { TrainingIndexRow } from '../../training/shared/types'
import { addSource } from '../../watch/main/repository'
import { watchMigrations } from '../../watch/main/migrations'
import { homeView } from '../renderer/home-model'
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
  it('shows a self-study task as its training and leaves out the series task over it', () => {
    task('series', { title: 'Social Worlds self-study', list: 'Training' })
    task('day1', { title: 'Day 1', list: '', due: '2026-10-16' })
    db.prepare(
      "UPDATE tasks SET parent_uid = 'series', own_kind = 'self-study' WHERE uid = 'day1'"
    ).run()
    const summary = collect()
    expect(summary.tasks.research.today.map((t) => t.title)).toEqual([])
    expect(summary.upcoming.map((e) => e.title)).toEqual(['Social Worlds: Day 1'])
  })
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
    expect(s.tasks.research.today.map((t) => t.uid)).toEqual(['a'])
    expect(s.tasks.work.today.map((t) => t.uid)).toEqual(['w'])
    expect(s.tasks.research.overdue.map((t) => t.uid)).toEqual(['late'])
  })

  const training = (workspace: string, id: string, date: string, over = {}): void =>
    upsertTraining(db, {
      workspace,
      id,
      date,
      start: null,
      end: null,
      title: 'Lesson',
      series: '',
      type: null,
      mode: null,
      skills: [],
      leads: [],
      institution: null,
      folder: null,
      task: '',
      selfStudy: '',
      summary: '',
      excerpt: '',
      hasNotes: false,
      problems: [],
      contentHash: 'h',
      ...over
    } as TrainingIndexRow)

  it('keeps Life’s tasks and trainings in Life, and Research’s and Work’s out of it', () => {
    task('a')
    task('w', { workspace: 'work' })
    task('l', { workspace: 'life' })
    training('life', 'lt', '2026-10-16')
    training('research', 'rt', '2026-10-17', { title: 'Lecture' })
    const s = collect()
    expect(s.tasks.life.today.map((t) => t.uid)).toEqual(['l'])
    expect(s.tasks.research.today.map((t) => t.uid)).toEqual(['a'])
    expect(s.tasks.work.today.map((t) => t.uid)).toEqual(['w'])
    expect(s.tasks.life.today[0].route).toBe('/life/tasks/t/l')
    expect(s.upcoming.map((e) => [e.title, e.route])).toEqual([
      ['Lesson', '/life/training/t/lt'],
      ['Lecture', '/research/training/t/rt']
    ])
  })

  it('gives each workspace its own slots: eight overdue Life tasks do not change Research’s lists or totals', () => {
    task('a', { due: '2026-10-10' })
    for (let i = 0; i < 8; i += 1) task(`l${i}`, { workspace: 'life', due: '2026-10-01' })
    const s = collect()
    expect(s.tasks.research.overdue.map((t) => t.uid)).toEqual(['a'])
    expect(s.tasks.research.overdueTotal).toBe(1)
    expect(s.tasks.life.overdue).toHaveLength(5)
    expect(s.tasks.life.overdueTotal).toBe(8)
  })

  it('hides a Life series task over Life self-study tasks and shows each as its training', () => {
    task('series', { workspace: 'life', title: 'Course self-study', list: 'Training' })
    task('day1', { workspace: 'life', title: 'Day 1', list: '', due: '2026-10-16' })
    db.prepare(
      "UPDATE tasks SET parent_uid = 'series', own_kind = 'self-study' WHERE uid = 'day1'"
    ).run()
    const s = collect()
    expect(s.tasks.life.today).toEqual([])
    expect(s.upcoming.map((e) => [e.title, e.route])).toEqual([
      ['Course: Day 1', '/life/tasks/t/day1']
    ])
    expect(s.upcoming.map((e) => e.route.startsWith('/research'))).toEqual([false])
  })

  it('has no meetings for Life, and Life’s meetings (if any existed) stay off the next-meeting card', () => {
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, series, date, start_time, content_hash) VALUES ('life', 'x', 'Chat', '2026-10-22', '10:00', 'h')`
    ).run()
    const s = collect()
    expect(s.meetings.next).toBeNull()
    expect(s.upcoming).toEqual([])
  })

  it('gives a subtask its parent’s list and sublist, which it has none of itself', () => {
    task('parent', { list: 'Thesis', due: null })
    db.prepare("UPDATE tasks SET sublist = 'Methods' WHERE uid = 'parent'").run()
    task('kid', { list: '' })
    db.prepare("UPDATE tasks SET parent_uid = 'parent' WHERE uid = 'kid'").run()
    const kid = collect().tasks.research.today.find((t) => t.uid === 'kid')
    expect(kid?.list).toBe('Thesis › Methods')
  })

  it('leaves out the subtask a meeting or a training owns', () => {
    task('own-meeting')
    task('own-training')
    task('ordinary')
    db.prepare(
      `INSERT INTO meetings (workspace, meeting_id, series, date, content_hash, task) VALUES ('research', 'm1', 'Supervision', '2026-10-20', 'h', 'own-meeting')`
    ).run()
    db.prepare(
      `INSERT INTO training (workspace, entry_id, date, title, skills, leads, summary, excerpt, has_notes, problems, content_hash, task)
       VALUES ('research', 't1', '2026-10-21', 'R day', '[]', '[]', '', '', 0, '[]', 'h', 'own-training')`
    ).run()
    const s = collect()
    expect(s.tasks.research.today.map((t) => t.uid)).toEqual(['ordinary'])
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
    expect(collect().tasks.research.today.map((t) => t.uid)).toEqual(['auto-task'])
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
    expect(collect().watch).toEqual({ research: null, life: null })
    addSource(
      db,
      { title: 'S', url: 'https://ex.org/f', kind: 'conference', method: 'feed' },
      'now'
    )
    expect(collect().watch.research?.counts.sources).toBe(1)
  })

  it('puts only SAVED items in Coming up, and every new one in the brief', () => {
    const source = addSource(
      db,
      { title: 'S', url: 'https://ex.org/f', kind: 'conference', method: 'feed' },
      'now'
    )
    const insert = db.prepare(
      `INSERT INTO watch_items (source_id, item_key, title, url, deadline, state, first_seen_at)
       VALUES (?, ?, ?, 'https://ex.org/i', ?, ?, '2026-10-14T00:00:00.000Z')`
    )
    insert.run(source.id, 'a', 'Saved deadline', '2026-10-17', 'saved')
    insert.run(source.id, 'b', 'New deadline', '2026-10-16', 'new')
    insert.run(source.id, 'c', 'Seen deadline', '2026-10-16', 'seen')
    const summary = collect()
    expect(summary.upcoming.filter((e) => e.id.startsWith('watch:')).map((e) => e.title)).toEqual([
      'Saved deadline'
    ])
    expect(summary.watch.research?.fresh.map((i) => i.title)).toEqual(['New deadline'])
  })
})

describe('collectHomeSummary: Watch per workspace', () => {
  const sourceOf = (workspace: 'research' | 'life', n: number): number =>
    addSource(
      db,
      { title: `S${n}`, url: `https://ex.org/${n}`, kind: 'conference', method: 'feed', workspace },
      'now'
    ).id
  const item = (sourceId: number, key: string, state: string, date: string): void => {
    db.prepare(
      `INSERT INTO watch_items (source_id, item_key, title, url, deadline, state, first_seen_at)
       VALUES (?, ?, ?, 'https://ex.org/i', ?, ?, '2026-10-14T00:00:00.000Z')`
    ).run(sourceId, key, `Item ${key}`, date, state)
  }

  it('each workspace has its own brief; one with no source has none', () => {
    sourceOf('life', 1)
    expect(collect().watch.research).toBeNull()
    expect(collect().watch.life?.counts.sources).toBe(1)
    sourceOf('research', 2)
    expect(collect().watch.research?.counts.sources).toBe(1)
  })

  it('new items, counts and saved dates never cross workspaces', () => {
    const r = sourceOf('research', 1)
    const l = sourceOf('life', 2)
    item(r, 'r-new', 'new', '2026-10-16')
    item(r, 'r-saved', 'saved', '2026-10-17')
    item(l, 'l-new', 'new', '2026-10-16')
    item(l, 'l-new2', 'new', '2026-10-16')
    item(l, 'l-saved', 'saved', '2026-10-18')
    const s = collect()
    expect(s.watch.research?.fresh.map((i) => i.title)).toEqual(['Item r-new'])
    expect(s.watch.life?.fresh.map((i) => i.title).sort()).toEqual(['Item l-new', 'Item l-new2'])
    expect(s.watch.research?.counts.new).toBe(1)
    expect(s.watch.life?.counts.new).toBe(2)
    const dated = s.upcoming.filter((e) => e.id.startsWith('watch:'))
    expect(dated.map((e) => [e.title, e.workspace])).toEqual([
      ['Item r-saved', 'research'],
      ['Item l-saved', 'life']
    ])
    expect(homeView(s, 'life').comingUp.map((e) => [e.title, e.route])).toEqual([
      ['Item l-saved', '/life/watch']
    ])
    expect(homeView(s, 'research').comingUp.map((e) => [e.title, e.route])).toEqual([
      ['Item r-saved', '/research/watch']
    ])
    expect(homeView(s, 'work').comingUp).toEqual([])
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
  const insertTraining = (id: string, task: string, over: Partial<TrainingIndexRow> = {}): void =>
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

  it('counts a meeting and a training that have a task and times, as the Hours page does', () => {
    task('m1', { due: null, title: 'Supervision' })
    task('l1', { due: null, title: 'Plotly' })
    insertMeeting('research', 'm', 'm1')
    insertTraining('l', 'l1')
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
    insertTraining('autoonly', 'auto')
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

  it('a time tracked on the training’s self-study task and its session both count', () => {
    task('l1', { due: null })
    insertTraining('l', 'l1')
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

  const life: TrackingYear = {
    ...emptyYear('2026-09-21', LIFE_PLAN),
    adjusts: [{ id: 'p', date: '2026-10-15', label: 'Piano', minutes: 20 }]
  }

  it('Life: a training’s own session counts in Life’s week, as in Research’s, and not in Research’s', () => {
    task('lt', { workspace: 'life', due: null, title: 'Lesson' })
    insertTraining('life-day', 'lt', { workspace: 'life' })
    const h = hours({ research, life })
    expect(h.life).toMatchObject({ label: 'This week', aimMinutes: 0, todayMinutes: 20 })
    expect(h.life?.minutes).toBe(20 + 90)
    expect(h.research?.minutes).toBe(30)
  })

  it('Life: a Research training does not count in Life’s week', () => {
    task('rt', { due: null })
    insertTraining('research-day', 'rt')
    expect(hours({ research, life }).life?.minutes).toBe(20)
    expect(hours({ research, life }).research?.minutes).toBe(30 + 90)
  })

  it('Life: no year holding today gives no hours, and an empty Life gives a total of nothing', () => {
    expect(hours({ research }).life).toBeNull()
    const empty: TrackingYear = emptyYear('2026-09-21', LIFE_PLAN)
    expect(hours({ life: empty }).life).toMatchObject({ minutes: 0, todayMinutes: 0 })
  })

  it('Life’s running timer reaches the summary, labelled for Life', () => {
    const tracking: TrackingSource = {
      running: () => ({
        workspace: 'life',
        year: '2026-09-21',
        session: { id: 's', date: '2026-10-15', start: '09:30:00', end: null, label: 'Piano' }
      }),
      years: () => [],
      get: () => emptyYear('2026-09-21')
    }
    expect(collect(tracking).timer).toEqual({
      workspace: 'life',
      label: 'Piano',
      date: '2026-10-15',
      time: '09:30',
      minutes: 60
    })
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
