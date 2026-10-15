import { describe, expect, it } from 'vitest'
import type { HomeEvent, HomeSummary, HomeTask } from '../shared/types'
import { homeView, whenLabel } from './home-model'

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
  hours: null,
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

  it("takes this workspace's meeting from the list when the next one overall is the other's", () => {
    const s: HomeSummary = {
      ...base,
      meetings: {
        next: {
          workspace: 'research',
          id: '1',
          series: 'Supervision',
          date: '2026-10-16',
          start: '10:00',
          end: null,
          route: '/research/meetings/m/1'
        },
        openTodos: 3
      },
      upcoming: [
        event('meeting:research:1', 'meeting', '/research/meetings/m/1', 1),
        event('meeting:work:2', 'meeting', '/work/meetings/m/2', 4)
      ]
    }
    expect(homeView(s, 'research').nextMeeting).toMatchObject({ title: 'Supervision', inDays: 1 })
    expect(homeView(s, 'work').nextMeeting).toMatchObject({ title: 'meeting:work:2', inDays: 4 })
    expect(homeView(s, 'research').openTodos).toBe(3)
    expect(homeView(s, 'work').openTodos).toBeNull()
  })
})

describe('whenLabel', () => {
  it('names today and tomorrow and counts the rest', () => {
    expect(whenLabel(0, '14:00')).toBe('Today 14:00')
    expect(whenLabel(1, null)).toBe('Tomorrow')
    expect(whenLabel(4, '11:00')).toBe('In 4 days 11:00')
  })
})
