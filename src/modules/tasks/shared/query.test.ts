import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TASKS_QUERY,
  defaultList,
  dueTone,
  formatDue,
  formatTaskTime,
  listChoices,
  listValue,
  normaliseTasksQuery,
  parseListValue,
  queryTasks,
  reconcileQuery,
  tagsIn,
  viewCounts
} from './query'
import { task } from './test-utils'
import type { Task } from './types'
import type { TaskRow } from './views'

const row = (over: Partial<Task>, kids: Task[] = []): TaskRow => ({ task: task(over), kids })

describe('normaliseTasksQuery', () => {
  it('repairs anything remembered badly', () => {
    expect(normaliseTasksQuery(null)).toEqual(DEFAULT_TASKS_QUERY)
    expect(
      normaliseTasksQuery({ view: 'nope', priority: 'urgent', sort: 'x', dir: 'desc', search: 3 })
    ).toEqual({ ...DEFAULT_TASKS_QUERY, dir: 'desc' })
    expect(normaliseTasksQuery({ view: 'done', priority: 'high', tag: 'r' })).toMatchObject({
      view: 'done',
      priority: 'high',
      tag: 'r'
    })
  })
})

describe('lists', () => {
  const rows = [
    row({ uid: 'a', list: 'Study 2', sublist: 'Data' }),
    row({ uid: 'b', list: 'Study 2', sublist: 'Data' }),
    row({ uid: 'c', list: 'Study 2' }),
    row({ uid: 'd', list: 'Admin' })
  ]
  it('offers each list followed by its sublists', () => {
    expect(listChoices(rows)).toEqual([
      { list: 'Admin', sublist: '', count: 1 },
      { list: 'Study 2', sublist: '', count: 3 },
      { list: 'Study 2', sublist: 'Data', count: 2 }
    ])
  })
  it('round-trips a list value', () => {
    expect(parseListValue(listValue('A', 'B'))).toEqual({ list: 'A', sublist: 'B' })
    expect(parseListValue(listValue('A'))).toEqual({ list: 'A', sublist: '' })
  })
  it('drops a remembered list or tag that no longer exists', () => {
    const q = { ...DEFAULT_TASKS_QUERY, list: listValue('Gone'), tag: 'old' }
    expect(reconcileQuery(q, rows)).toMatchObject({ list: '', tag: '' })
    const ok = { ...DEFAULT_TASKS_QUERY, list: listValue('Study 2', 'Data') }
    expect(reconcileQuery(ok, rows).list).toBe(ok.list)
  })
})

describe('queryTasks', () => {
  const rows = [
    row({ uid: 'a', title: 'Alpha', due: '2026-10-09', list: 'Reading', tags: ['r'] }),
    row({ uid: 'b', title: 'Beta', due: '2026-10-02', list: 'Writing', priority: 'high' }),
    row({ uid: 'c', title: 'Gamma', list: 'Reading' }),
    row({ uid: 'd', title: 'Delta', status: 'done', completedAt: '2026-10-01T00:00:00Z' }),
    row({ uid: 'e', title: 'Eps', status: 'done', completedAt: '2026-10-03T00:00:00Z' }),
    row({ uid: 'f', title: 'Zeta', status: 'doing', list: 'Reading' })
  ]
  const ids = (q: Partial<typeof DEFAULT_TASKS_QUERY>): string[] =>
    queryTasks(rows, { ...DEFAULT_TASKS_QUERY, ...q }).map((r) => r.task.uid)

  it('splits the views: open (due soonest first), backlog, done (latest first)', () => {
    expect(ids({ view: 'open' })).toEqual(['b', 'a', 'f'])
    expect(ids({ view: 'backlog' })).toEqual(['c'])
    expect(ids({ view: 'done' })).toEqual(['e', 'd'])
  })
  it('filters by list, priority, tag and search words (also subtasks)', () => {
    expect(ids({ list: 'Reading' })).toEqual(['a', 'f'])
    expect(ids({ priority: 'high' })).toEqual(['b'])
    expect(ids({ tag: 'r' })).toEqual(['a'])
    expect(ids({ search: 'alp' })).toEqual(['a'])
    const withKid = [
      row({ uid: 'p', title: 'Parent', due: '2026-10-09' }, [
        task({ uid: 'k', parentUid: 'p', title: 'Needle' })
      ])
    ]
    expect(queryTasks(withKid, { ...DEFAULT_TASKS_QUERY, search: 'needle' })).toHaveLength(1)
  })
  it('sorts by a column and keeps empty dates last either way', () => {
    expect(ids({ sort: 'due', dir: 'asc' })).toEqual(['b', 'a', 'f'])
    expect(ids({ sort: 'due', dir: 'desc' })).toEqual(['a', 'b', 'f'])
    expect(ids({ sort: 'title', dir: 'desc' })).toEqual(['f', 'b', 'a'])
    expect(ids({ sort: 'priority', dir: 'asc' })[0]).toBe('b')
  })
  it('counts each view under the other filters', () => {
    expect(viewCounts(rows, { ...DEFAULT_TASKS_QUERY, list: 'Reading' })).toEqual({
      open: 2,
      backlog: 1,
      done: 2
    })
    expect(tagsIn(rows)).toEqual(['r'])
  })
})

describe('dates and time', () => {
  const today = '2026-10-05'
  it('shows a due date with the year only when it is not this year', () => {
    expect(formatDue(today, today)).toBe('Today')
    expect(formatDue('2026-10-09', today)).toBe('Oct 9')
    expect(formatDue('2027-01-04', today)).toBe('Jan 4, 2027')
    expect(dueTone('2026-10-04', today)).toBe('overdue')
    expect(dueTone(today, today)).toBe('today')
    expect(dueTone('2026-10-06', today)).toBe('normal')
  })
  it('shows time as hours and minutes, and nothing for none', () => {
    expect(formatTaskTime(225)).toBe('3:45')
    expect(formatTaskTime(5)).toBe('0:05')
    expect(formatTaskTime(0)).toBe('')
  })
})

describe('defaultList', () => {
  const rows = [
    row({ uid: 'a', list: 'Reading', sublist: 'Scoping' }),
    row({ uid: 'b', list: 'Reading' }),
    row({ uid: 'c', list: 'Admin' }),
    row({ uid: 'd', list: 'Admin', status: 'done' })
  ]
  it('prefers the list being looked at, then the last used, then the busiest', () => {
    expect(defaultList(rows, { filter: listValue('Admin') })).toEqual({
      list: 'Admin',
      sublist: ''
    })
    expect(defaultList(rows, { last: { list: 'Reading', sublist: 'Scoping' } })).toEqual({
      list: 'Reading',
      sublist: 'Scoping'
    })
    expect(defaultList(rows, {})).toEqual({ list: 'Reading', sublist: '' })
  })
  it('ignores a list that no longer exists, and has a name for an empty workspace', () => {
    expect(
      defaultList(rows, { filter: listValue('Gone'), last: { list: 'Gone', sublist: '' } }).list
    ).toBe('Reading')
    expect(defaultList([], {})).toEqual({ list: 'General', sublist: '' })
  })
  describe('in Work (with clients)', () => {
    const work = [
      row({ uid: 'a', list: 'Impact' }),
      row({ uid: 'b', list: 'Luminos' }),
      row({ uid: 'c', list: 'Luminos' })
    ]
    const clients = ['Impact', 'Royal Holloway']
    it('never picks a list that is no client, even the busiest', () => {
      expect(defaultList(work, { clients })).toEqual({ list: 'Impact', sublist: '' })
      expect(defaultList(work, { clients, filter: listValue('Luminos') }).list).toBe('Impact')
      expect(defaultList(work, { clients, last: { list: 'Luminos', sublist: '' } }).list).toBe(
        'Impact'
      )
    })
    it('takes an empty client list being looked at, in the client’s spelling', () => {
      expect(defaultList(work, { clients, filter: listValue('royal holloway') })).toEqual({
        list: 'Royal Holloway',
        sublist: ''
      })
    })
    it('falls back to the first client, and to nothing with no client', () => {
      expect(defaultList([], { clients })).toEqual({ list: 'Impact', sublist: '' })
      expect(defaultList(work, { clients: [] })).toEqual({ list: '', sublist: '' })
    })
  })
})

describe('listChoices with clients', () => {
  const rows = [row({ uid: 'a', list: 'Impact', sublist: 'Data' }), row({ uid: 'b', list: 'Old' })]
  it('adds a client that has no task, keeps a list with tasks that is no client', () => {
    expect(listChoices(rows, ['impact', 'Royal Holloway'])).toEqual([
      { list: 'Impact', sublist: '', count: 1 },
      { list: 'Impact', sublist: 'Data', count: 1 },
      { list: 'Old', sublist: '', count: 1 },
      { list: 'Royal Holloway', sublist: '', count: 0 }
    ])
  })
  it('is unchanged without clients', () => {
    expect(listChoices(rows).map((c) => c.list)).toEqual(['Impact', 'Impact', 'Old'])
  })
  it('keeps a filter on an empty client list through reconcileQuery', () => {
    const q = { ...DEFAULT_TASKS_QUERY, list: listValue('Royal Holloway') }
    expect(reconcileQuery(q, rows, ['Royal Holloway']).list).toBe(q.list)
    expect(reconcileQuery(q, rows).list).toBe('')
  })
})
