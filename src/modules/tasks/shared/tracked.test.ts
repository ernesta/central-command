import { describe, expect, it } from 'vitest'
import { year as baseYear } from '@shared/tracking/test-utils'
import type { TrackingYear } from '@shared/tracking/types'
import { hoursByMonth, taskKey, taskUidOf, trackedByTask } from './tracked'

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
