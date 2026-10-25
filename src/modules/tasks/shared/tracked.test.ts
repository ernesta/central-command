import { describe, expect, it } from 'vitest'
import { deleteTaskTime } from '@shared/tracking/totals'
import { year as baseYear } from '@shared/tracking/test-utils'
import type { TrackingYear } from '@shared/tracking/types'
import { taskTime } from './views'
import { task } from './test-utils'
import { hoursByMonth, taskKey, taskUidOf, trackedByTask, undatedEarlier } from './tracked'

const year = (over: Partial<TrackingYear>): TrackingYear => baseYear(over)

describe('trackedByTask', () => {
  it('adds the reported minutes of sessions and the typed time that name a task, across years', () => {
    const a = year({
      sessions: [
        {
          id: '1',
          date: '2026-09-21',
          start: '09:00:00',
          end: '10:00:00',
          minutes: 60,
          label: 'X',
          task: taskKey('t1')
        },
        {
          id: '2',
          date: '2026-09-21',
          start: '10:00:00',
          end: '10:20:00',
          minutes: 15,
          label: 'Y'
        },
        {
          id: '3',
          date: '2026-09-22',
          start: '10:00:00',
          end: null,
          label: 'X',
          task: taskKey('t1')
        }
      ],
      adjusts: [{ id: 'a', date: '2026-09-21', label: 'X', minutes: 30, task: taskKey('t1') }]
    })
    const b = year({
      start: '2025-09-22',
      sessions: [
        {
          id: '4',
          date: '2025-10-01',
          start: '09:00:00',
          end: '09:30:00',
          minutes: 30,
          label: 'Z',
          task: taskKey('t2')
        }
      ],
      adjusts: [{ id: 'b', date: '2025-10-01', label: 'X', minutes: 15, task: taskKey('t1') }]
    })
    const m = trackedByTask([a, b])
    expect(m.get('t1')).toBe(105)
    expect(m.get('t2')).toBe(30)
    expect(m.size).toBe(2)
  })
  it('knows a task key from any other value', () => {
    expect(taskUidOf(taskKey('abc'))).toBe('abc')
    expect(taskUidOf('cc://person/abc')).toBeNull()
    expect(taskUidOf(undefined)).toBeNull()
  })
})

describe('history linked to a task', () => {
  it('is not added to the task: ClickUp’s time already holds it', () => {
    const y = year({
      adjusts: [
        {
          id: 'h',
          date: '2025-10-06',
          label: 'Old',
          minutes: 105,
          task: taskKey('t1'),
          earlier: true
        },
        { id: 'n', date: '2026-10-05', label: 'New', minutes: 30, task: taskKey('t1') }
      ]
    })
    expect(trackedByTask([y]).get('t1')).toBe(30)
  })
})

describe('a session covered by ClickUp time', () => {
  it('is not added to the task again', () => {
    const y = year({
      sessions: [
        {
          id: 's',
          date: '2026-10-05',
          start: '17:00:00',
          end: '19:00:00',
          minutes: 120,
          label: 'X',
          task: taskKey('t1'),
          earlier: true
        },
        {
          id: 't',
          date: '2026-10-06',
          start: '09:00:00',
          end: '09:30:00',
          minutes: 30,
          label: 'X',
          task: taskKey('t1')
        }
      ]
    })
    expect(trackedByTask([y]).get('t1')).toBe(30)
    expect(hoursByMonth([y], 't1')).toEqual([{ month: '2026-10', minutes: 150 }])
  })
})

describe('hoursByMonth', () => {
  it('lists all of a task’s hours by month, history included, oldest first', () => {
    const y = year({
      adjusts: [
        {
          id: 'h',
          date: '2025-11-03',
          label: 'Old',
          minutes: 90,
          task: taskKey('t1'),
          earlier: true
        },
        {
          id: 'g',
          date: '2025-10-30',
          label: 'Old',
          minutes: 30,
          task: taskKey('t1'),
          earlier: true
        },
        { id: 'n', date: '2025-11-20', label: 'New', minutes: 15, task: taskKey('t1') },
        { id: 'o', date: '2025-11-20', label: 'Other', minutes: 45, task: taskKey('t2') }
      ]
    })
    expect(hoursByMonth([y], 't1')).toEqual([
      { month: '2025-10', minutes: 30 },
      { month: '2025-11', minutes: 105 }
    ])
    expect(hoursByMonth([y], 'none')).toEqual([])
  })
})

describe("deleting a task's time for a day", () => {
  it("takes it out of the task's tracked time and its months, and leaves other tasks and days", () => {
    const key = taskKey('t1')
    const y = {
      ...baseYear(),
      sessions: [
        {
          id: 's1',
          date: '2026-09-29',
          start: '09:00:00',
          end: '09:30:00',
          minutes: 30,
          label: 'A',
          task: key
        },
        {
          id: 's2',
          date: '2026-09-30',
          start: '09:00:00',
          end: '10:00:00',
          minutes: 60,
          label: 'A',
          task: key
        }
      ],
      adjusts: [{ id: 'a1', date: '2026-09-29', label: 'A', minutes: 15, task: key }]
    }
    const after = deleteTaskTime(y, '2026-09-29', 'A')
    expect(trackedByTask([after]).get('t1')).toBe(60)
    expect(hoursByMonth([after], 't1')).toEqual([{ month: '2026-09', minutes: 60 }])
    const gone = deleteTaskTime(after, '2026-09-30', 'A')
    expect(trackedByTask([gone]).get('t1')).toBeUndefined()
    expect(hoursByMonth([gone], 't1')).toEqual([])
  })
})

describe('trackedByTask with the tasks’ ClickUp time', () => {
  // PS5210's "Introduction": a subtask under a series task, made after the import, with 2:00 typed on it and marked `earlier`.
  const intro = year({
    adjusts: [
      {
        id: 'a',
        date: '2026-09-30',
        label: 'Introduction',
        minutes: 120,
        task: taskKey('sxbn2jqc'),
        earlier: true
      }
    ]
  })
  it('counts earlier history that the task’s ClickUp time does not hold', () => {
    expect(trackedByTask([intro]).get('sxbn2jqc')).toBeUndefined()
    expect(trackedByTask([intro], new Map([['sxbn2jqc', 0]])).get('sxbn2jqc')).toBe(120)
  })
  it('counts only the part ClickUp’s time falls short of', () => {
    expect(trackedByTask([intro], new Map([['sxbn2jqc', 90]])).get('sxbn2jqc')).toBe(30)
  })
  it('leaves earlier history alone when ClickUp’s time holds it', () => {
    expect(trackedByTask([intro], new Map([['sxbn2jqc', 120]])).get('sxbn2jqc')).toBeUndefined()
  })
  it('shows on the subtask’s page and in the series total once', () => {
    const tracked = trackedByTask([intro], new Map([['sxbn2jqc', 0]]))
    const parent = task({ uid: 'jkabweh5' })
    const sub = task({ uid: 'sxbn2jqc', parentUid: 'jkabweh5', ownKind: 'training' })
    expect(taskTime({ task: sub, kids: [] }, tracked).total).toBe(120)
    expect(taskTime({ task: parent, kids: [sub] }, tracked).total).toBe(120)
  })
})

describe('undatedEarlier', () => {
  const dated = (minutes: number): TrackingYear =>
    year({
      adjusts: [
        { id: 'h', date: '2026-10-05', label: 'X', minutes, task: taskKey('t1'), earlier: true }
      ]
    })

  it('leaves only the ClickUp time with no known day', () => {
    expect(undatedEarlier([dated(135)], 't1', 135)).toBe(0)
    expect(undatedEarlier([dated(60)], 't1', 135)).toBe(75)
  })

  it('never goes below zero, and ignores other tasks', () => {
    expect(undatedEarlier([dated(200)], 't1', 135)).toBe(0)
    expect(undatedEarlier([dated(60)], 't2', 135)).toBe(135)
  })
})
