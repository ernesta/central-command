import { describe, expect, it } from 'vitest'
import type { HomeEvent, HomeSummary, HomeTask } from '../shared/types'
import {
  comingUpItems,
  dayLabel,
  detailText,
  eventDetail,
  groupTasks,
  homeView,
  timeRange,
  whenLabel
} from './home-model'

const task = (uid: string, workspace: 'research' | 'work', daysLate = 0): HomeTask => ({
  uid,
  title: uid,
  parent: null,
  parentUid: null,
  parentStatus: null,
  parentPriority: null,
  parentDue: null,
  study: false,
  workspace,
  list: 'L',
  due: '2026-10-15',
  priority: 'normal',
  status: 'todo',
  daysLate,
  route: `/${workspace}/tasks/t/${uid}`
})
const event = (id: string, kind: HomeEvent['kind'], route: string, inDays: number): HomeEvent => ({
  id,
  kind,
  date: '2026-10-16',
  time: null,
  title: id,
  detail: '',
  route,
  inDays
})
const base: HomeSummary = {
  today: '2026-10-15',
  generatedAt: '',
  timer: null,
  hours: { research: null, work: null },
  tasks: { overdue: [], today: [], overdueTotal: 0, todayTotal: 0 },
  meetings: { next: null, openTodos: 4 },
  upcoming: [],
  watch: null,
  weather: null
}

describe('homeView', () => {
  it('keeps each workspace to its own tasks', () => {
    const s: HomeSummary = {
      ...base,
      tasks: {
        overdue: [task('a', 'research', 2), task('b', 'work', 1)],
        today: [task('c', 'work')],
        overdueTotal: 2,
        todayTotal: 1
      }
    }
    expect(homeView(s, 'work').tasks.overdue.map((t) => t.uid)).toEqual(['b'])
    expect(homeView(s, 'work').tasks.today.map((t) => t.uid)).toEqual(['c'])
    expect(homeView(s, 'research').tasks.today).toEqual([])
    expect(homeView(s, 'work').tasks.cut).toBe(false)
  })

  it('says when the summary cut a list short', () => {
    const s = { ...base, tasks: { ...base.tasks, today: [task('c', 'work')], todayTotal: 12 } }
    expect(homeView(s, 'work').tasks.cut).toBe(true)
  })

  it('shows the next 3 days of this workspace, and nothing from Watch', () => {
    const s: HomeSummary = {
      ...base,
      upcoming: [
        event('m1', 'meeting', '/research/meetings/m/1', 1),
        event('m2', 'meeting', '/work/meetings/m/2', 2),
        event('tr', 'training', '/research/training/t/x', 3),
        event('late', 'task', '/research/tasks/t/y', 4),
        event('w', 'deadline', 'https://ex.org', 3)
      ]
    }
    expect(homeView(s, 'research').comingUp.map((e) => e.id)).toEqual(['m1', 'tr'])
    expect(homeView(s, 'work').comingUp.map((e) => e.id)).toEqual(['m2'])
  })

  it("puts today's events in Today, timed first in time order, and starts Coming up tomorrow", () => {
    const at = (
      id: string,
      time: string | null,
      inDays: number,
      kind: HomeEvent['kind'] = 'meeting'
    ): HomeEvent => ({
      ...event(id, kind, `/research/x/${id}`, inDays),
      time
    })
    const s: HomeSummary = {
      ...base,
      upcoming: [
        at('off', null, 0, 'time-off'),
        at('late', '15:00', 0),
        at('early', '09:00', 0, 'training'),
        at('next', '08:00', 1)
      ]
    }
    const view = homeView(s, 'research')
    expect(view.todayEvents.map((e) => e.id)).toEqual(['early', 'late', 'off'])
    expect(view.comingUp.map((e) => e.id)).toEqual(['next'])
  })

  it('has no next-meeting card or TODO count (removed 23 Oct 2026)', () => {
    const view = homeView(base, 'research')
    expect(Object.keys(view).sort()).toEqual(['comingUp', 'tasks', 'todayEvents'])
  })
})

describe('whenLabel and dayLabel', () => {
  it('puts the time at the right and the day on the second line', () => {
    expect(whenLabel('14:00')).toBe('2:00 PM')
    expect(whenLabel('13:45', '15:00')).toBe('1:45 PM–3:00 PM')
    expect(whenLabel(null)).toBe('')
    expect(dayLabel(0)).toBe('')
    expect(dayLabel(1)).toBe('tomorrow')
    expect(dayLabel(4)).toBe('in 4 days')
  })

  it('writes a range only when the end differs from the start', () => {
    expect(timeRange('09:00', '09:00')).toBe('9:00 AM')
    expect(timeRange('09:00', null)).toBe('9:00 AM')
  })
})

describe('eventDetail', () => {
  const initials = (n: string): string | null => (n === 'Me Myself' ? null : n.slice(0, 2))
  const ev = (over: Partial<HomeEvent>): HomeEvent => ({
    ...event('x', 'meeting', '/r', 0),
    ...over
  })

  it("names a meeting's attendees (without the user) and a training's format", () => {
    expect(eventDetail(ev({ attendees: ['Ada L', 'Me Myself', 'Bo C'] }), initials)).toBe(
      'Meeting · with Ad, Bo'
    )
    expect(eventDetail(ev({ attendees: [] }), initials)).toBe('Meeting')
    expect(eventDetail(ev({ kind: 'training', mode: 'online' }), initials)).toBe(
      'Training · Online'
    )
    expect(eventDetail(ev({ kind: 'training', mode: null }), initials)).toBe('Training')
    expect(eventDetail(ev({ kind: 'training', mode: 'in-person', inDays: 2 }), initials)).toBe(
      'Training · In person · in 2 days'
    )
    expect(eventDetail(ev({ attendees: ['Bo C'], inDays: 1 }), initials)).toBe(
      'Meeting · with Bo · tomorrow'
    )
    expect(eventDetail(ev({ kind: 'time-off', detail: '', inDays: 3 }), initials)).toBe('In 3 days')
    expect(eventDetail(ev({ kind: 'time-off', detail: '3 days, to 2026-10-21' }), initials)).toBe(
      '3 days, to Oct 21'
    )
  })
})

describe('detailText', () => {
  it('writes the end of a run of days off as a day and month', () => {
    expect(detailText('3 days, to 2026-10-21')).toBe('3 days, to Oct 21')
    expect(detailText('Admin')).toBe('Admin')
  })
})

const TODAY = '2026-10-16'

describe('groupTasks', () => {
  const kid = (uid: string, parentUid: string): HomeTask => ({
    ...task(uid, 'work'),
    parent: parentUid,
    parentUid
  })
  it('puts a subtask under its task, wherever it came in the list', () => {
    const groups = groupTasks(
      [kid('k1', 'p'), task('a', 'work'), task('p', 'work'), kid('k2', 'p')],
      TODAY
    )
    expect(groups.map((g) => [g.head?.uid, g.kids.map((k) => k.uid)])).toEqual([
      ['a', []],
      ['p', ['k1', 'k2']]
    ])
  })
  it('names a parent that is not due as context', () => {
    const [g] = groupTasks([kid('k1', 'p')], TODAY)
    expect(g.head).toBeNull()
    expect(g.context).toMatchObject({ uid: 'p', title: 'p' })
    expect(g.kids).toHaveLength(1)
  })
  it('gives a parent that is not due its own due date, and how late it is', () => {
    const [a] = groupTasks([{ ...kid('k', 'p'), parentDue: '2026-11-02' }], TODAY)
    expect(a.context).toMatchObject({ due: '2026-11-02', daysLate: 0 })
    const [b] = groupTasks([{ ...kid('k', 'p'), parentDue: '2026-10-14' }], TODAY)
    expect(b.context).toMatchObject({ daysLate: 2 })
    const [c] = groupTasks([kid('k', 'p')], TODAY)
    expect(c.context?.due).toBe('')
  })
})

describe('comingUpItems', () => {
  const taskEvent = (uid: string, parentUid: string | null, inDays: number): HomeEvent => ({
    ...event(uid, 'task', `/work/tasks/t/${uid}`, inDays),
    task: {
      uid,
      status: 'todo',
      priority: 'normal',
      parent: parentUid,
      parentUid,
      parentStatus: parentUid ? 'todo' : null,
      parentPriority: parentUid ? 'normal' : null,
      parentDue: null,
      study: false
    }
  })
  it('groups tasks where the first of them is and leaves the other events as they are', () => {
    const items = comingUpItems(
      [
        taskEvent('k1', 'p', 1),
        event('m', 'meeting', '/work/meetings/m/1', 2),
        taskEvent('p', null, 2),
        taskEvent('k2', 'p', 2),
        taskEvent('solo', null, 3)
      ],
      'work',
      TODAY
    )
    expect(
      items.map((i) => (i.group ? [i.group.head?.uid, i.group.kids.map((k) => k.uid)] : i.event.id))
    ).toEqual([['p', ['k1', 'k2']], 'm', ['solo', []]])
  })
})
