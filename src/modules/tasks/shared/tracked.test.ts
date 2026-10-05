import { describe, expect, it } from 'vitest'
import { year as baseYear } from '@shared/tracking/test-utils'
import type { TrackingYear } from '@shared/tracking/types'
import { taskKey, taskKeyForLabel, taskUidOf, trackedByTask } from './tracked'

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

describe('taskKeyForLabel', () => {
  const tasks = [
    { uid: 'a', title: 'Write the paper' },
    { uid: 'b', title: 'Duplicate' },
    { uid: 'c', title: 'duplicate ' }
  ]
  it('links a name that matches exactly one task, ignoring case and spaces', () => {
    expect(taskKeyForLabel(tasks, ' write THE paper')).toBe(taskKey('a'))
  })
  it('does not guess when none or several match', () => {
    expect(taskKeyForLabel(tasks, 'Duplicate')).toBeUndefined()
    expect(taskKeyForLabel(tasks, 'Nothing')).toBeUndefined()
    expect(taskKeyForLabel(tasks, '  ')).toBeUndefined()
  })
})
