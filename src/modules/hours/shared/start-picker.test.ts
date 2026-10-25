import { describe, expect, it } from 'vitest'
import { emptyYear } from '@shared/tracking/types'
import {
  clientForTask,
  clientOfList,
  listForNew,
  detailOfTask,
  listOfTask,
  pickerOptions,
  suggestedTasks
} from './start-picker'
import type { Task } from '../../tasks/shared/types'

const task = (uid: string, title: string, extra: Partial<Task> = {}): Task =>
  ({ uid, title, list: 'Inbox', parentUid: null, status: 'todo', ...extra }) as Task

const tasks = [
  task('1', 'Write the report'),
  task('2', 'Report to the board'),
  task('3', 'Marking'),
  task('4', 'Reporting', { list: 'Impact' })
]

describe('pickerOptions', () => {
  it('lists nothing and offers nothing to create before anything is typed', () => {
    expect(pickerOptions(tasks, '')).toEqual({ tasks: [], create: null })
    expect(pickerOptions(tasks, '   ')).toEqual({ tasks: [], create: null })
  })

  it('lists matches, those that start with the text first, and always ends with Create', () => {
    const r = pickerOptions(tasks, 'report')
    expect(r.tasks.map((t) => t.uid)).toEqual(['2', '4', '1'])
    expect(r.create).toBe('report')
  })

  it('offers Create even when a title matches exactly, and for text that matches nothing', () => {
    expect(pickerOptions(tasks, ' Marking ').create).toBe('Marking')
    expect(pickerOptions(tasks, 'zzz')).toEqual({ tasks: [], create: 'zzz' })
  })

  it('ignores case and accents, and is limited', () => {
    expect(pickerOptions([task('9', 'Café notes')], 'CAFE').tasks).toHaveLength(1)
    const many = Array.from({ length: 20 }, (_, i) => task(String(i), `Report ${i}`))
    expect(pickerOptions(many, 'rep', 5).tasks).toHaveLength(5)
  })
})

describe('suggestedTasks', () => {
  const year = {
    ...emptyYear('2026-09-21'),
    sessions: [
      {
        id: 'a',
        date: '2026-10-05',
        start: '09:00:00',
        end: '10:00:00',
        label: 'x',
        task: 'cc://task/1'
      },
      {
        id: 'b',
        date: '2026-10-06',
        start: '09:00:00',
        end: '10:00:00',
        label: 'x',
        task: 'cc://task/3'
      },
      {
        id: 'c',
        date: '2026-10-06',
        start: '11:00:00',
        end: '12:00:00',
        label: 'x',
        task: 'cc://task/1'
      },
      {
        id: 'd',
        date: '2026-09-01',
        start: '09:00:00',
        end: '10:00:00',
        label: 'x',
        task: 'cc://task/2'
      },
      { id: 'e', date: '2026-10-06', start: '13:00:00', end: '14:00:00', label: 'no task' }
    ]
  }

  it('is the open tasks of the last week, latest first, each once; none for label-only or old time', () => {
    expect(suggestedTasks(year, tasks, '2026-10-07').map((t) => t.uid)).toEqual(['1', '3'])
  })

  it('leaves out a task that is no longer open', () => {
    expect(suggestedTasks(year, tasks.slice(2), '2026-10-07').map((t) => t.uid)).toEqual(['3'])
  })

  it('puts tasks due today first, then in-progress ones, then those used on the most days; each once', () => {
    const open = [
      task('1', 'Report', { due: '2026-10-07' }),
      task('3', 'Marking', { status: 'doing' }),
      task('2', 'Board'),
      task('9', 'Due today, never timed', { due: '2026-10-07' })
    ]
    expect(suggestedTasks(year, open, '2026-10-07').map((t) => t.uid)).toEqual(['1', '9', '3'])
  })

  it('puts tasks already worked on today before the others due today', () => {
    const open = [task('9', 'Due today', { due: '2026-10-06' }), ...tasks]
    expect(suggestedTasks(year, open, '2026-10-06').map((t) => t.uid)).toEqual(['1', '3', '9'])
  })

  it('is limited', () => {
    expect(suggestedTasks(year, tasks, '2026-10-07', 1)).toHaveLength(1)
  })
})

describe('the client of a task', () => {
  const luminos = { year: '1', clients: ['Impact', 'Teaching & Learning'] }
  const ra = { year: '2', clients: ['Royal Holloway'] }

  it('is none where there are no clients', () => {
    expect(clientForTask([], 'Inbox')).toBeUndefined()
  })

  it('is the list when the list is a client, ignoring case', () => {
    expect(clientForTask([luminos, ra], 'impact')).toBe('Impact')
    expect(clientOfList([luminos, ra], 'Royal Holloway')).toBe('Royal Holloway')
  })

  it('is still the list when its contract is not open, never another client', () => {
    expect(clientForTask([ra], 'Impact')).toBe('Impact')
  })
})

describe('lists', () => {
  it("a subtask is in its parent's list", () => {
    const parent = task('p', 'Parent', { list: 'Impact' })
    const sub = task('s', 'Sub', { list: '', parentUid: 'p' })
    expect(listOfTask(sub, [parent, sub])).toBe('Impact')
    expect(listOfTask(parent, [parent, sub])).toBe('Impact')
  })

  it("the picker names a task by its list, a subtask by its parent's", () => {
    const parent = task('p', 'Intro to Python', { list: 'Training' })
    const sub = task('s', 'Session 3', { list: '', parentUid: 'p' })
    expect(detailOfTask(sub, [parent, sub])).toBe('Training')
    expect(detailOfTask(parent, [parent, sub])).toBe('Training')
    expect(detailOfTask(sub, [sub])).toBe('')
  })

  it("the second line names the sublist too, a subtask its parent's", () => {
    const parent = task('p', 'Pipeline', { list: 'Impact', sublist: 'Historical Data Analysis' })
    const sub = task('s', 'Sub', { list: '', parentUid: 'p' })
    expect(detailOfTask(parent, [parent, sub])).toBe('Impact › Historical Data Analysis')
    expect(detailOfTask(sub, [parent, sub])).toBe('Impact › Historical Data Analysis')
  })

  it("the Create row offers a client list in Work (the time's client, else the last, else the first); elsewhere the last, else the first, else Inbox", () => {
    const clients = ['Impact', 'Royal Holloway']
    expect(listForNew(tasks, clients, 'Inbox', 'royal holloway')).toBe('Royal Holloway')
    expect(listForNew(tasks, clients, 'Royal Holloway')).toBe('Royal Holloway')
    expect(listForNew(tasks, clients, 'Marking list')).toBe('Impact')
    expect(listForNew(tasks, [], 'Marking list')).toBe('Marking list')
    expect(listForNew(tasks, [], '')).toBe('Inbox')
    expect(listForNew([], [], '')).toBe('Inbox')
  })
})
