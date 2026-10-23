import { describe, expect, it } from 'vitest'
import type { HomeEvent, HomeSummary, HomeTask } from '../shared/types'
import { detailText, homeView, whenLabel } from './home-model'

const task = (uid: string, workspace: 'research' | 'work', daysLate = 0): HomeTask => ({
  uid,
  title: uid,
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

  it('shows the next 7 days of this workspace, and nothing from Watch', () => {
    const s: HomeSummary = {
      ...base,
      upcoming: [
        event('m1', 'meeting', '/research/meetings/m/1', 1),
        event('m2', 'meeting', '/work/meetings/m/2', 2),
        event('tr', 'training', '/research/training/t/x', 7),
        event('late', 'task', '/research/tasks/t/y', 8),
        event('w', 'deadline', 'https://ex.org', 3)
      ]
    }
    expect(homeView(s, 'research').comingUp.map((e) => e.id)).toEqual(['m1', 'tr'])
    expect(homeView(s, 'work').comingUp.map((e) => e.id)).toEqual(['m2'])
  })

  it('has no next-meeting card or TODO count (removed 23 Oct 2026)', () => {
    const view = homeView(base, 'research')
    expect(Object.keys(view).sort()).toEqual(['comingUp', 'tasks'])
  })
})

describe('whenLabel', () => {
  it('names today and tomorrow and counts the rest', () => {
    expect(whenLabel(0, '14:00')).toBe('Today 2:00 PM')
    expect(whenLabel(1, null)).toBe('Tomorrow')
    expect(whenLabel(4, '11:00')).toBe('In 4 days 11:00 AM')
  })
})

describe('detailText', () => {
  it('writes the end of a run of days off as a day and month', () => {
    expect(detailText('3 days, to 2026-10-21')).toBe('3 days, to Oct 21')
    expect(detailText('Admin')).toBe('Admin')
  })
})
