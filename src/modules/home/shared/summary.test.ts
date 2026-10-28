import { describe, expect, it } from 'vitest'
import type { WatchItem } from '../../watch/shared/types'
import { buildHomeSummary, daysFrom, SHOWN_TASKS, type HomeInputs, type TaskInput } from './summary'

const base: HomeInputs = {
  today: '2026-10-15',
  nowMinutes: 10 * 60,
  generatedAt: '2026-10-15T10:00:00.000Z',
  tasks: [],
  meetings: [],
  trainings: [],
  openMeetingTodos: 0,
  timer: null,
  hours: { research: null, work: null, life: null },
  timeOff: [],
  watch: { research: null, life: null },
  weather: null
}

const task = (over: Partial<TaskInput> & { uid: string }): TaskInput => ({
  title: over.uid,
  workspace: 'research',
  list: 'Reading',
  due: '2026-10-15',
  priority: 'normal',
  status: 'todo',
  ...over
})

const watchItem = (over: Partial<WatchItem>): WatchItem => ({
  id: 1,
  sourceId: 1,
  workspace: 'research',
  sourceTitle: 'LINGUIST List',
  kind: 'conference',
  title: 'A conference',
  url: 'https://ex.org/c',
  summary: '',
  publishedAt: null,
  date: '2026-11-10',
  dateKind: 'deadline',
  score: 3,
  matched: ['literacy'],
  state: 'new',
  firstSeenAt: '2026-10-14T00:00:00.000Z',
  ...over
})

describe('tasks', () => {
  it('splits overdue from due today, leaves out done, undated and future tasks', () => {
    const s = buildHomeSummary({
      ...base,
      tasks: [
        task({ uid: 'late', due: '2026-10-10' }),
        task({ uid: 'now' }),
        task({ uid: 'done', status: 'done', due: '2026-10-01' }),
        task({ uid: 'none', due: null }),
        task({ uid: 'later', due: '2026-10-20' })
      ]
    })
    expect(s.tasks.research.overdue.map((t) => [t.uid, t.daysLate])).toEqual([['late', 5]])
    expect(s.tasks.research.today.map((t) => [t.uid, t.daysLate])).toEqual([['now', 0]])
  })

  it('puts the most overdue first, then high priority, then by title', () => {
    const s = buildHomeSummary({
      ...base,
      tasks: [
        task({ uid: 'b', due: '2026-10-14' }),
        task({ uid: 'a', due: '2026-10-14' }),
        task({ uid: 'h', due: '2026-10-14', priority: 'high' }),
        task({ uid: 'old', due: '2026-10-01', priority: 'low' })
      ]
    })
    expect(s.tasks.research.overdue.map((t) => t.uid)).toEqual(['old', 'h', 'a', 'b'])
  })

  it('shows a handful and says how many there are', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      task({ uid: `t${String(i).padStart(2, '0')}` })
    )
    const s = buildHomeSummary({ ...base, tasks: many })
    expect(s.tasks.research.today).toHaveLength(SHOWN_TASKS)
    expect(s.tasks.research.todayTotal).toBe(12)
  })

  it('links a task to its page in its own workspace', () => {
    const s = buildHomeSummary({ ...base, tasks: [task({ uid: 'w1', workspace: 'work' })] })
    expect(s.tasks.work.today[0].route).toBe('/work/tasks/t/w1')
    expect(s.tasks.research.today).toEqual([])
  })
})

describe('meetings', () => {
  const m = (
    id: string,
    date: string,
    start: string | null,
    end: string | null = null
  ): HomeInputs['meetings'][number] => ({
    workspace: 'research',
    id,
    series: 'Supervision',
    date,
    start,
    end,
    attendees: ['Ada Lovelace'],
    mode: 'online'
  })

  it('the next meeting is the soonest one not over yet', () => {
    const s = buildHomeSummary({
      ...base,
      nowMinutes: 11 * 60,
      meetings: [
        m('earlier', '2026-10-15', '09:00', '10:00'),
        m('later-today', '2026-10-15', '14:00', '15:00'),
        m('tomorrow', '2026-10-16', '09:00')
      ]
    })
    expect(s.meetings.next?.id).toBe('later-today')
  })

  it('a meeting under way is still next, a past one is not, a timeless one today counts', () => {
    const run = (
      nowMinutes: number,
      list = [m('x', '2026-10-15', '10:00', '11:00')]
    ): string | undefined =>
      buildHomeSummary({ ...base, nowMinutes, meetings: list }).meetings.next?.id
    expect(run(10 * 60 + 30)).toBe('x')
    expect(run(11 * 60 + 1)).toBeUndefined()
    expect(run(20 * 60, [m('t', '2026-10-15', null)])).toBe('t')
  })

  it('carries the open TODO count and an encoded route', () => {
    const s = buildHomeSummary({
      ...base,
      openMeetingTodos: 4,
      meetings: [m('2026-10-16 Supervision', '2026-10-16', '09:00')]
    })
    expect(s.meetings.openTodos).toBe(4)
    expect(s.meetings.next?.route).toBe('/research/meetings/m/2026-10-16%20Supervision')
  })
})

describe('upcoming', () => {
  it('merges tasks, meetings, time off and saved Watch dates into one dated list, soonest first (unsaved items never)', () => {
    const s = buildHomeSummary({
      ...base,
      tasks: [
        task({ uid: 'soon', due: '2026-10-17', title: 'Soon task' }),
        task({ uid: 'far', due: '2026-12-01' })
      ],
      meetings: [
        {
          workspace: 'work',
          id: 'w',
          series: 'Impact',
          date: '2026-10-16',
          start: '09:30',
          end: '10:00',
          attendees: [],
          mode: null
        }
      ],
      trainings: [
        {
          workspace: 'research',
          id: '2026-10-15 R',
          title: 'R workshop',
          date: '2026-10-15',
          start: '10:00',
          end: '12:00',
          mode: 'in-person'
        },
        {
          workspace: 'research',
          id: 'far',
          title: 'Far away',
          date: '2027-03-01',
          start: null,
          end: null,
          mode: null
        }
      ],
      timeOff: [
        { date: '2026-10-19', type: 'leave' },
        { date: '2026-10-20', type: 'leave' },
        { date: '2026-10-21', type: 'leave' },
        { date: '2026-12-25', type: 'public' }
      ],
      watch: {
        research: {
          counts: { new: 1, newRelevant: 1, sources: 1, failing: 0, changed: 0 },
          fresh: [],
          upcoming: [
            watchItem({ title: 'Abstract deadline', date: '2026-10-18', state: 'saved' }),
            watchItem({
              id: 2,
              title: 'Summer school',
              date: '2027-06-01',
              dateKind: 'date',
              state: 'saved'
            }),
            watchItem({ id: 3, title: 'Never saved', date: '2026-10-16', state: 'new' }),
            watchItem({ id: 4, title: 'Seen only', date: '2026-10-17', state: 'seen' })
          ]
        },
        life: null
      }
    })
    expect(s.upcoming.map((e) => [e.date, e.kind, e.title])).toEqual([
      ['2026-10-15', 'training', 'R workshop'],
      ['2026-10-16', 'meeting', 'Impact'],
      ['2026-10-17', 'task', 'Soon task'],
      ['2026-10-18', 'deadline', 'Abstract deadline'],
      ['2026-10-19', 'time-off', 'Annual leave'],
      ['2027-06-01', 'event', 'Summer school']
    ])
    expect(s.upcoming[4].detail).toBe('3 days, to 2026-10-21')
    expect(s.upcoming[3].route).toBe('https://ex.org/c')
  })

  it("carries a session's end, attendees and format, and no workspace name", () => {
    const s = buildHomeSummary({
      ...base,
      nowMinutes: 9 * 60,
      meetings: [
        {
          workspace: 'research',
          id: 'a',
          series: '',
          date: '2026-10-15',
          start: '13:45',
          end: '15:00',
          attendees: ['Ada Lovelace'],
          mode: 'online'
        }
      ]
    })
    expect(s.upcoming[0]).toMatchObject({
      title: 'Untitled meeting',
      detail: '',
      end: '15:00',
      attendees: ['Ada Lovelace'],
      mode: 'online'
    })
  })

  it('drops a training that is over today, keeps one under way, and keeps all of today past the cap', () => {
    const tr = (id: string, start: string, end: string): HomeInputs['trainings'][number] => ({
      workspace: 'research',
      id,
      title: id,
      date: '2026-10-15',
      start,
      end,
      mode: null
    })
    const s = buildHomeSummary({
      ...base,
      nowMinutes: 11 * 60,
      trainings: [tr('over', '09:00', '10:00'), tr('now', '10:30', '12:00')]
    })
    expect(s.upcoming.map((e) => e.id)).toEqual(['training:research:now'])
  })

  it('does not repeat today\'s tasks as "coming up"', () => {
    const s = buildHomeSummary({ ...base, tasks: [task({ uid: 'now' })] })
    expect(s.upcoming).toEqual([])
  })

  it('keeps only five of the days ahead for each workspace', () => {
    const tasks = (workspace: 'research' | 'life', n: number): TaskInput[] =>
      Array.from({ length: n }, (_, i) =>
        task({ uid: `${workspace}${i}`, workspace, due: '2026-10-20' })
      )
    const s = buildHomeSummary({ ...base, tasks: [...tasks('research', 20), ...tasks('life', 8)] })
    const ids = (w: string): string[] =>
      s.upcoming.filter((e) => e.route.startsWith(`/${w}/`)).map((e) => e.id)
    expect(ids('research')).toHaveLength(5)
    expect(ids('life')).toHaveLength(5)
  })

  it("keeps every one of today's events and every saved Watch date, past the cap", () => {
    const items = Array.from({ length: 9 }, (_, i) =>
      watchItem({ id: i + 1, state: 'saved', date: `2026-10-${20 + i}` })
    )
    const s = buildHomeSummary({
      ...base,
      tasks: Array.from({ length: 9 }, (_, i) => task({ uid: `t${i}`, due: '2026-10-20' })),
      watch: {
        research: {
          counts: { new: 0, newRelevant: 0, sources: 1, failing: 0, changed: 0 },
          fresh: [],
          upcoming: items
        },
        life: null
      }
    })
    expect(s.upcoming.filter((e) => e.id.startsWith('watch:'))).toHaveLength(9)
    expect(s.upcoming.filter((e) => e.id.startsWith('task:'))).toHaveLength(5)
  })

  it('counts what the cap left out of the Coming up window, per workspace', () => {
    const s = buildHomeSummary({
      ...base,
      tasks: [
        ...Array.from({ length: 7 }, (_, i) => task({ uid: `n${i}`, due: '2026-10-16' })),
        task({ uid: 'far', due: '2026-10-25' }),
        task({ uid: 'w', workspace: 'work', due: '2026-10-16' })
      ]
    })
    expect(s.upcoming.filter((e) => e.id.startsWith('task:n'))).toHaveLength(5)
    expect(s.upcomingCut).toEqual({ research: 2 })
  })

  it('a Life training has a Life route and its own event id', () => {
    const s = buildHomeSummary({
      ...base,
      trainings: [
        {
          workspace: 'life',
          id: 'x',
          title: 'Lesson',
          date: '2026-10-16',
          start: null,
          end: null,
          mode: null
        },
        {
          workspace: 'research',
          id: 'x',
          title: 'Lecture',
          date: '2026-10-16',
          start: null,
          end: null,
          mode: null
        }
      ]
    })
    expect(s.upcoming.map((e) => [e.id, e.route])).toEqual([
      ['training:research:x', '/research/training/t/x'],
      ['training:life:x', '/life/training/t/x']
    ])
  })
})

describe('the rest', () => {
  it('passes the timer, hours and weather through, and caps the Watch brief', () => {
    const timer = {
      workspace: 'research' as const,
      label: 'Reading',
      date: '2026-10-15',
      time: '09:00',
      minutes: 60
    }
    const hours = {
      research: {
        label: 'This week' as const,
        minutes: 600,
        aimMinutes: 2250,
        todayMinutes: 60,
        clients: []
      },
      work: null,
      life: null
    }
    const items = Array.from({ length: 60 }, (_, i) => watchItem({ id: i + 1 }))
    const s = buildHomeSummary({
      ...base,
      timer,
      hours,
      watch: {
        research: {
          counts: { new: 60, newRelevant: 9, sources: 2, failing: 0, changed: 0 },
          fresh: items,
          upcoming: []
        },
        life: null
      }
    })
    expect(s.timer).toBe(timer)
    expect(s.hours).toBe(hours)
    expect(s.watch.research?.fresh).toHaveLength(50)
    expect(s.weather).toBeNull()
  })

  it('counts days between dates across a month and a year', () => {
    expect(daysFrom('2026-12-30', '2027-01-02')).toBe(3)
    expect(daysFrom('2026-10-15', '2026-10-10')).toBe(-5)
  })
})

describe('a task’s marks', () => {
  it('passes the parent and the self-study mark through to the row and its event', () => {
    const s = buildHomeSummary({
      ...base,
      tasks: [
        task({ uid: 'kid', due: '2026-10-10', parent: 'Publish Study A' }),
        task({
          uid: 'study',
          title: 'PS5210: Day 1',
          list: 'Training · self-study',
          study: true,
          due: '2026-10-16'
        })
      ]
    })
    expect(s.tasks.research.overdue[0]).toMatchObject({
      uid: 'kid',
      parent: 'Publish Study A',
      study: false
    })
    expect(s.upcoming.find((e) => e.id === 'task:study')?.task).toMatchObject({ study: true })
  })
})
