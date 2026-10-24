import { describe, expect, it } from 'vitest'
import { DEFAULT_HOME_SETTINGS } from '@shared/home-settings'
import type { WatchItem } from '../../watch/shared/types'
import { digestLine, planNotifications, pruneSent } from './notifications'
import { buildWidgetSnapshot } from './widget'
import type { HomeSummary } from './types'

const on = { ...DEFAULT_HOME_SETTINGS.notifications, enabled: true }
const empty: HomeSummary = {
  today: '2026-10-15',
  generatedAt: '2026-10-15T08:40:00.000Z',
  timer: null,
  hours: { research: null, work: null },
  tasks: { overdue: [], today: [], overdueTotal: 0, todayTotal: 0 },
  meetings: { next: null, openTodos: 0 },
  upcoming: [],
  watch: null,
  weather: null
}
const task = (uid: string, daysLate = 0): HomeSummary['tasks']['today'][number] => ({
  uid,
  title: uid,
  parent: null,
  study: false,
  workspace: 'research',
  list: 'Reading',
  due: '2026-10-15',
  priority: 'normal',
  status: 'todo',
  daysLate,
  route: `/research/tasks/t/${uid}`
})
const meeting = (start: string | null): NonNullable<HomeSummary['meetings']['next']> => ({
  workspace: 'research',
  id: 'm1',
  series: 'Supervision',
  date: '2026-10-15',
  start,
  end: null,
  route: '/research/meetings/m/m1'
})
const state = { sent: new Set<string>(), since: '2026-10-01T00:00:00.000Z' }
const at = (time: string): { date: string; time: string } => ({ date: '2026-10-15', time })
const withDay: HomeSummary = {
  ...empty,
  tasks: {
    overdue: [task('late', 3)],
    today: [task('a'), task('b')],
    overdueTotal: 1,
    todayTotal: 2
  },
  meetings: { next: meeting('14:00'), openTodos: 0 }
}
const watched = (id: number, firstSeenAt = '2026-10-14T00:00:00.000Z'): WatchItem => ({
  id,
  sourceId: 1,
  sourceTitle: 'LL',
  kind: 'conference',
  title: `Item ${id}`,
  url: 'https://ex.org',
  summary: '',
  publishedAt: null,
  date: null,
  dateKind: null,
  score: 3,
  matched: ['literacy'],
  state: 'new',
  firstSeenAt
})

describe('planNotifications', () => {
  it('says nothing when turned off, whatever is going on', () => {
    expect(planNotifications(withDay, { ...on, enabled: false }, state, at('09:00'))).toEqual([])
  })

  it('sends the digest once the time has come, with the day in a line, and only once', () => {
    expect(planNotifications(withDay, on, state, at('08:29'))).toEqual([])
    const [d] = planNotifications(withDay, on, state, at('08:30'))
    expect(d).toMatchObject({
      key: 'digest:2026-10-15',
      title: 'Today',
      body: '2 tasks due, 1 overdue · Supervision at 14:00'
    })
    expect(
      planNotifications(withDay, on, { ...state, sent: new Set([d.key]) }, at('08:31'))
    ).toEqual([])
  })

  it('sends no digest for an empty day or when the digest is off', () => {
    expect(planNotifications(empty, on, state, at('09:00'))).toEqual([])
    expect(planNotifications(withDay, { ...on, digestAt: '' }, state, at('09:00'))).toEqual([])
  })

  it('reminds shortly before a meeting that has a start time, not earlier or later', () => {
    const run = (time: string): string[] =>
      planNotifications(withDay, { ...on, digestAt: '' }, state, at(time)).map((n) => n.body)
    expect(run('13:49')).toEqual([])
    expect(run('13:50')).toEqual(['Starts in 10 minutes (14:00)'])
    expect(run('13:59')).toEqual(['Starts in 1 minute (14:00)'])
    expect(run('14:00')).toEqual(['Starts now (14:00)'])
    expect(run('14:01')).toEqual([])
    expect(
      planNotifications(
        { ...withDay, meetings: { next: meeting(null), openTodos: 0 } },
        on,
        state,
        at('13:55')
      ).filter((n) => n.key.startsWith('meeting'))
    ).toEqual([])
  })

  it('warns about a timer left running, once per timer', () => {
    const s = {
      ...empty,
      timer: {
        workspace: 'research' as const,
        label: 'Reading',
        date: '2026-10-15',
        time: '06:00',
        minutes: 200
      }
    }
    expect(planNotifications(s, { ...on, timerRunningHours: 3 }, state, at('09:20'))).toHaveLength(
      1
    )
    expect(planNotifications(s, { ...on, timerRunningHours: 4 }, state, at('09:20'))).toEqual([])
    expect(planNotifications(s, on, state, at('09:20'))).toEqual([])
  })

  it('groups new Watch matches in one notification and announces nothing found before notifications were on', () => {
    const s: HomeSummary = {
      ...empty,
      watch: {
        counts: { new: 3, newRelevant: 3, sources: 1, failing: 0, changed: 0 },
        relevant: [watched(1), watched(2), watched(3, '2026-09-01T00:00:00.000Z')]
      }
    }
    const [n] = planNotifications(s, { ...on, digestAt: '' }, state, at('09:00'))
    expect(n).toMatchObject({ key: 'watch:2', title: '2 new in Watch', body: 'Item 1, and 1 more' })
    expect(n.covers).toEqual(['watch:1', 'watch:2'])
    expect(
      planNotifications(
        s,
        { ...on, digestAt: '' },
        { ...state, sent: new Set(n.covers) },
        at('09:01')
      )
    ).toEqual([])
    expect(
      planNotifications(s, { ...on, digestAt: '', watchRelevant: false }, state, at('09:00'))
    ).toEqual([])
  })

  it('warns of a deadline within the chosen days, once, and not of an ordinary event', () => {
    const s: HomeSummary = {
      ...empty,
      upcoming: [
        {
          id: 'watch:7',
          kind: 'deadline',
          date: '2026-10-20',
          time: null,
          title: 'Abstracts',
          detail: '',
          route: 'https://ex.org/a',
          inDays: 5
        },
        {
          id: 'watch:8',
          kind: 'deadline',
          date: '2026-12-01',
          time: null,
          title: 'Far',
          detail: '',
          route: 'https://ex.org/b',
          inDays: 47
        },
        {
          id: 'watch:9',
          kind: 'event',
          date: '2026-10-16',
          time: null,
          title: 'Event',
          detail: '',
          route: 'https://ex.org/c',
          inDays: 1
        }
      ]
    }
    const [n, ...rest] = planNotifications(s, { ...on, digestAt: '' }, state, at('09:00'))
    expect(rest).toEqual([])
    expect(n).toMatchObject({
      title: 'Deadline in 5 days',
      body: 'Abstracts',
      route: 'https://ex.org/a'
    })
    expect(
      planNotifications(s, { ...on, digestAt: '', watchDeadlineDays: 0 }, state, at('09:00'))
    ).toEqual([])
  })
})

describe('digestLine and pruneSent', () => {
  it('speaks of one task in the singular and says nothing for nothing', () => {
    expect(digestLine({ ...empty, tasks: { ...empty.tasks, todayTotal: 1 } })).toBe('1 task due')
    expect(digestLine(empty)).toBe('')
  })

  it('forgets keys older than a month', () => {
    expect(pruneSent({ a: '2026-08-01', b: '2026-10-01' }, '2026-10-15')).toEqual({
      b: '2026-10-01'
    })
  })
})

describe('buildWidgetSnapshot', () => {
  it('puts overdue tasks first, caps the list, and carries only what a widget draws', () => {
    const many = Array.from({ length: 6 }, (_, i) => task(`t${i}`))
    const snap = buildWidgetSnapshot({
      ...withDay,
      tasks: { overdue: [task('late', 2)], today: many, overdueTotal: 1, todayTotal: 6 },
      timer: {
        workspace: 'research',
        label: 'Reading',
        date: '2026-10-15',
        time: '08:00',
        minutes: 40
      },
      hours: {
        research: {
          label: 'This week',
          minutes: 600,
          aimMinutes: 2250,
          todayMinutes: 40,
          clients: []
        },
        work: {
          label: 'This month',
          minutes: 900,
          aimMinutes: 4800,
          todayMinutes: 120,
          clients: [{ client: 'Impact', minutes: 900 }]
        }
      }
    })
    expect(snap.version).toBe(1)
    expect(snap.tasks.map((t) => t.title)).toEqual(['late', 't0', 't1', 't2', 't3'])
    expect(snap.tasks[0].overdue).toBe(true)
    expect(snap.taskCounts).toEqual({ overdue: 1, today: 6 })
    expect(snap.timer).toEqual({ label: 'Reading', minutes: 40 })
    expect(snap.nextMeeting).toEqual({ title: 'Supervision', date: '2026-10-15', time: '14:00' })
    expect(snap.week).toEqual({
      label: 'This week',
      minutes: 600,
      aimMinutes: 2250,
      todayMinutes: 40,
      clients: []
    })
    expect(snap.work).toMatchObject({ label: 'This month', minutes: 900, aimMinutes: 4800 })
    expect(JSON.stringify(snap)).not.toContain('uid')
  })
})
