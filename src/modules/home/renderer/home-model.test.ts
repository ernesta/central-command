import { describe, expect, it } from 'vitest'
import type { HomeEvent, HomeSummary, HomeTask } from '../shared/types'
import { detailText, eventDetail, groupTasks, homeView, timeRange, whenLabel } from './home-model'

const task = (uid: string, workspace: 'research' | 'work', daysLate = 0): HomeTask => ({
  uid,
  title: uid,
  parent: null,
  parentUid: null,
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

describe('whenLabel', () => {
  it('says only the time for today, and names tomorrow and counts the rest', () => {
    expect(whenLabel(0, '14:00')).toBe('2:00 PM')
    expect(whenLabel(0, '13:45', '15:00')).toBe('1:45 PM–3:00 PM')
    expect(whenLabel(0, null)).toBe('')
    expect(whenLabel(1, null)).toBe('Tomorrow')
    expect(whenLabel(1, '09:00', '10:30')).toBe('Tomorrow 9:00 AM–10:30 AM')
    expect(whenLabel(4, '11:00')).toBe('In 4 days 11:00 AM')
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

describe('groupTasks', () => {
  const kid = (uid: string, parentUid: string): HomeTask => ({
    ...task(uid, 'work'),
    parent: parentUid,
    parentUid
  })
  it('puts a subtask under its task, wherever it came in the list', () => {
    const groups = groupTasks([
      kid('k1', 'p'),
      task('a', 'work'),
      task('p', 'work'),
      kid('k2', 'p')
    ])
    expect(groups.map((g) => [g.head?.uid, g.kids.map((k) => k.uid)])).toEqual([
      ['a', []],
      ['p', ['k1', 'k2']]
    ])
  })
  it('names a parent that is not due as context', () => {
    const [g] = groupTasks([kid('k1', 'p')])
    expect(g.head).toBeNull()
    expect(g.context).toMatchObject({ uid: 'p', title: 'p' })
    expect(g.kids).toHaveLength(1)
  })
})
