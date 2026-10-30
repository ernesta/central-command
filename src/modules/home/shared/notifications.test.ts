import { describe, expect, it } from 'vitest'
import { DEFAULT_HOME_SETTINGS } from '@shared/home-settings'
import type { WatchItem } from '../../watch/shared/types'
import { digestLine, planNotifications, pruneSent } from './notifications'
import { buildWidgetSnapshot } from './widget'
import type { HomeSummary, HomeTask, HomeWorkspace } from './types'
import { tasksIn } from './summary.testing'
import { buildHomeSummary } from './summary'

const on = {
  ...DEFAULT_HOME_SETTINGS.notifications,
  enabled: true,
  watchNew: true,
  watchSavedDays: 7
}
const empty: HomeSummary = {
  today: '2026-10-15',
  generatedAt: '2026-10-15T08:40:00.000Z',
  timer: null,
  hours: { research: null, work: null, life: null },
  tasks: tasksIn({}),
  meetings: { next: null, openTodos: 0 },
  upcoming: [],
  watch: { research: null, life: null },
  weather: null
}
const task = (uid: string, daysLate = 0, workspace: HomeWorkspace = 'research'): HomeTask => ({
  uid,
  title: uid,
  parent: null,
  parentUid: null,
  parentStatus: null,
  parentPriority: null,
  parentDue: null,
  study: false,
  workspace,
  list: 'Reading',
  due: '2026-10-15',
  priority: 'normal',
  status: 'todo',
  daysLate,
  route: `/${workspace}/tasks/t/${uid}`,
  watch: null
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
  tasks: tasksIn({
    research: {
      overdue: [task('late', 3)],
      today: [task('a'), task('b')],
      overdueTotal: 1,
      todayTotal: 2
    }
  }),
  meetings: { next: meeting('14:00'), openTodos: 0 }
}
const watched = (id: number, firstSeenAt = '2026-10-14T00:00:00.000Z'): WatchItem => ({
  id,
  sourceId: 1,
  workspace: 'research',
  sourceTitle: 'LL',
  section: 'conference',
  manual: false,
  title: `Item ${id}`,
  url: 'https://ex.org',
  summary: '',
  publishedAt: null,
  eventDate: null,
  eventEnd: null,
  deadline: null,
  deadlineLabel: null,
  date: null,
  dateKind: null,
  score: 3,
  matched: ['literacy'],
  state: 'new',
  firstSeenAt,
  readAt: null
})

describe('planNotifications', () => {
  it('says nothing when turned off, whatever is going on', () => {
    expect(planNotifications(withDay, { ...on, enabled: false }, state, at('09:00'))).toEqual([])
  })

  it('sends the digest once the time has come, with the day in a line, and only once', () => {
    expect(planNotifications(withDay, on, state, at('08:29'))).toEqual([])
    const [d] = planNotifications(withDay, on, state, at('08:30'))
    expect(d).toMatchObject({
      key: 'digest:research:2026-10-15',
      title: 'Today · Research',
      route: '/research',
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

  it('groups new Watch items in one notification and announces nothing found before notifications were on', () => {
    const s: HomeSummary = {
      ...empty,
      watch: {
        research: {
          counts: { new: 3, newRelevant: 3, sources: 1, failing: 0, changed: 0 },
          fresh: [watched(1), watched(2), watched(3, '2026-09-01T00:00:00.000Z')]
        },
        life: null
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
      planNotifications(s, { ...on, digestAt: '', watchNew: false }, state, at('09:00'))
    ).toEqual([])
  })

  it('gives Watch its own switches: with the master off only they speak, and with all off nothing does', () => {
    const s: HomeSummary = {
      ...empty,
      tasks: tasksIn({ research: { todayTotal: 2 } }),
      watch: {
        research: {
          counts: { new: 1, newRelevant: 1, sources: 1, failing: 0, changed: 0 },
          fresh: [watched(1)]
        },
        life: null
      }
    }
    const watchOnly = { ...on, enabled: false }
    expect(planNotifications(s, watchOnly, state, at('09:00')).map((n) => n.title)).toEqual([
      'New in Watch'
    ])
    expect(
      planNotifications(s, { ...watchOnly, watchNew: false, watchSavedDays: 0 }, state, at('09:00'))
    ).toEqual([])
  })

  it('warns of a saved deadline within the chosen days, once, and not of an ordinary event', () => {
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
      planNotifications(s, { ...on, digestAt: '', watchSavedDays: 0 }, state, at('09:00'))
    ).toEqual([])
  })
})

describe('digestLine and pruneSent', () => {
  it('speaks of one task in the singular and says nothing for nothing', () => {
    expect(
      digestLine({ ...empty, tasks: tasksIn({ research: { todayTotal: 1 } }) }, 'research')
    ).toBe('1 task due')
    expect(digestLine(empty, 'research')).toBe('')
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
      tasks: tasksIn({
        research: { overdue: [task('late', 2)], today: many, overdueTotal: 1, todayTotal: 6 }
      }),
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
        },
        life: null
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

describe('Life in the notifications and the widget file', () => {
  const busy: HomeSummary = {
    ...empty,
    tasks: tasksIn({
      research: { today: [task('r')], todayTotal: 1 },
      work: { overdue: [task('w', 2, 'work')], overdueTotal: 2 },
      life: {
        overdue: [task('l', 4, 'life')],
        today: [task('m', 0, 'life')],
        overdueTotal: 7,
        todayTotal: 9
      }
    }),
    meetings: { next: meeting('14:00'), openTodos: 0 }
  }

  it('each workspace’s digest line counts only its own tasks', () => {
    expect(digestLine(busy, 'research')).toBe('1 task due · Supervision at 14:00')
    expect(digestLine(busy, 'work')).toBe('2 overdue')
    expect(digestLine(busy, 'life')).toBe('9 tasks due, 7 overdue')
  })

  it('sends one digest per workspace, each opening its own page, and none for an empty one', () => {
    const planned = planNotifications(busy, { ...on, meetingMinutesBefore: 0 }, state, at('09:00'))
    expect(planned.map((n) => [n.key, n.title, n.body, n.route])).toEqual([
      [
        'digest:research:2026-10-15',
        'Today · Research',
        '1 task due · Supervision at 14:00',
        '/research'
      ],
      ['digest:work:2026-10-15', 'Today · Work', '2 overdue', '/work'],
      ['digest:life:2026-10-15', 'Today · Life', '9 tasks due, 7 overdue', '/life']
    ])
    const onlyLife: HomeSummary = { ...empty, tasks: tasksIn({ life: { todayTotal: 1 } }) }
    expect(planNotifications(onlyLife, on, state, at('09:00')).map((n) => n.key)).toEqual([
      'digest:life:2026-10-15'
    ])
  })

  it('sending one workspace’s digest does not send the others again, and the old single key covers Research', () => {
    const sent = new Set(['digest:life:2026-10-15'])
    expect(
      planNotifications(
        busy,
        { ...on, meetingMinutesBefore: 0 },
        { ...state, sent },
        at('09:00')
      ).map((n) => n.key)
    ).toEqual(['digest:research:2026-10-15', 'digest:work:2026-10-15'])
    const legacy = new Set(['digest:2026-10-15'])
    expect(
      planNotifications(
        busy,
        { ...on, meetingMinutesBefore: 0 },
        { ...state, sent: legacy },
        at('09:00')
      ).map((n) => n.key)
    ).toEqual(['digest:work:2026-10-15', 'digest:life:2026-10-15'])
  })

  it('a Life timer’s reminder opens Life’s Hours, a Research timer’s Research’s', () => {
    const timer = (workspace: 'life' | 'research'): HomeSummary => ({
      ...empty,
      timer: { workspace, label: 'Piano', date: '2026-10-15', time: '06:00', minutes: 600 }
    })
    const route = (s: HomeSummary): string | undefined =>
      planNotifications(s, { ...on, digestAt: '', timerRunningHours: 8 }, state, at('16:00'))[0]
        ?.route
    expect(route(timer('life'))).toBe('/life/hours')
    expect(route(timer('research'))).toBe('/research/hours')
  })

  it('the widget file carries every workspace’s tasks, counts and hours', () => {
    const lifeHours = {
      label: 'This week' as const,
      minutes: 130,
      aimMinutes: 0,
      todayMinutes: 20,
      clients: []
    }
    const snap = buildWidgetSnapshot({ ...busy, hours: { ...busy.hours, life: lifeHours } })
    expect(snap.tasks.map((t) => [t.title, t.workspace, t.overdue])).toEqual(
      [
        ['l', 'life', true],
        ['w', 'work', true],
        ['m', 'life', false],
        ['r', 'research', false]
      ].slice(0, 5)
    )
    expect(snap.taskCounts).toEqual({ overdue: 9, today: 10 })
    expect(snap.taskCountsByWorkspace).toEqual({
      research: { overdue: 0, today: 1 },
      work: { overdue: 2, today: 0 },
      life: { overdue: 7, today: 9 }
    })
    expect(snap.life).toEqual(lifeHours)
    expect(snap.version).toBe(1)
  })
})

describe('Watch in the notifications, per workspace', () => {
  const brief = (ids: number[]): NonNullable<HomeSummary['watch']['life']> => ({
    counts: { new: ids.length, newRelevant: 0, sources: 1, failing: 0, changed: 0 },
    fresh: ids.map((id) => ({ ...watched(id), workspace: 'life' as const }))
  })
  const watchOnly = { ...on, enabled: false, digestAt: '' }

  it('Life’s new items are their own notification, opening Life’s Watch page, and Research’s stay Research’s', () => {
    const s: HomeSummary = {
      ...empty,
      watch: { research: brief([1]), life: brief([2, 3]) }
    }
    const planned = planNotifications(s, watchOnly, state, at('09:00'))
    expect(planned.map((n) => [n.title, n.route, n.key])).toEqual([
      ['New in Watch', '/research/watch', 'watch:1'],
      ['2 new in Life Watch', '/life/watch', 'watch:3']
    ])
    expect(planned[1].covers).toEqual(['watch:2', 'watch:3'])
  })

  it('a workspace with nothing new says nothing', () => {
    const s: HomeSummary = { ...empty, watch: { research: null, life: brief([4]) } }
    expect(planNotifications(s, watchOnly, state, at('09:00')).map((n) => n.title)).toEqual([
      'New in Life Watch'
    ])
  })

  it('the widget counts new items per workspace and in all', () => {
    const snap = buildWidgetSnapshot({
      ...empty,
      watch: { research: brief([1]), life: brief([2, 3]) }
    })
    expect(snap.watchNew).toBe(3)
    expect(snap.watchNewByWorkspace).toEqual({ research: 1, life: 2 })
  })
})

describe('a Watch item with an open task', () => {
  const item = {
    ...watched(5),
    state: 'saved' as const,
    date: '2026-10-17',
    dateKind: 'deadline' as const
  }
  const summary = (watchLinked: number[]): HomeSummary =>
    buildHomeSummary({
      today: '2026-10-15',
      nowMinutes: 10 * 60,
      generatedAt: '2026-10-15T10:00:00.000Z',
      tasks: [
        {
          uid: 'apply',
          title: 'Apply',
          workspace: 'research',
          list: 'Admin',
          due: '2026-10-15',
          priority: 'normal',
          status: 'todo'
        }
      ],
      meetings: [],
      trainings: [],
      openMeetingTodos: 0,
      watchLinked: new Set(watchLinked),
      timer: null,
      hours: { research: null, work: null, life: null },
      timeOff: [],
      watch: {
        research: {
          counts: { new: 0, newRelevant: 0, sources: 1, failing: 0, changed: 0 },
          fresh: [],
          upcoming: [item]
        },
        life: null
      },
      weather: null
    })
  const plan = (s: HomeSummary): string[] =>
    planNotifications(s, on, state, at('09:00')).map((n) => n.key)

  it('gets no deadline notification of its own, and the task’s own (the digest) still comes', () => {
    expect(plan(summary([5]))).toEqual(['digest:research:2026-10-15'])
  })

  it('is notified as before once the task is done', () => {
    expect(plan(summary([]))).toContain('watch:5:2026-10-17')
  })
})
