import { describe, expect, it } from 'vitest'
import {
  addInterval,
  addMonths,
  describeRecurrence,
  isValidRecurrence,
  nextOccurrence
} from './recurrence'
import { task } from './test-utils'

describe('addMonths', () => {
  it('keeps the day when it exists', () => {
    expect(addMonths('2026-10-05', 1)).toBe('2026-11-05')
    expect(addMonths('2026-10-05', 12)).toBe('2027-10-05')
  })
  it('clamps to the last day of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28')
  })
  it('crosses the year', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
  })
})

describe('addInterval and describeRecurrence', () => {
  it('counts days, weeks and months', () => {
    expect(addInterval('2026-10-05', { every: 3, unit: 'day' })).toBe('2026-10-08')
    expect(addInterval('2026-10-05', { every: 2, unit: 'week' })).toBe('2026-10-19')
    expect(addInterval('2026-10-05', { every: 1, unit: 'month' })).toBe('2026-11-05')
  })
  it('words a rule', () => {
    expect(describeRecurrence({ every: 1, unit: 'week' })).toBe('Every week')
    expect(describeRecurrence({ every: 2, unit: 'month' })).toBe('Every 2 months')
  })
})

describe('isValidRecurrence', () => {
  it('accepts whole, positive counts of a known unit only', () => {
    expect(isValidRecurrence({ every: 1, unit: 'day' })).toBe(true)
    expect(isValidRecurrence({ every: 0, unit: 'day' })).toBe(false)
    expect(isValidRecurrence({ every: 1.5, unit: 'day' })).toBe(false)
    expect(isValidRecurrence({ every: 1, unit: 'year' })).toBe(false)
    expect(isValidRecurrence(null)).toBe(false)
  })
})

describe('nextOccurrence', () => {
  const weekly = task({
    uid: 'p',
    due: '2026-10-02',
    recurrence: { every: 1, unit: 'week' },
    description: 'Notes',
    tags: ['x'],
    priority: 'high',
    list: 'Admin',
    sublist: 'Sub'
  })

  it('is due the interval after the completion date, not after the old due date', () => {
    const next = nextOccurrence(weekly, [], '2026-10-05')
    expect(next?.task.due).toBe('2026-10-12')
    expect(next?.task).toMatchObject({
      title: 'A task',
      description: 'Notes',
      tags: ['x'],
      priority: 'high',
      list: 'Admin',
      sublist: 'Sub',
      recurrence: { every: 1, unit: 'week' }
    })
  })

  it('copies subtasks in order, not done, and keeps a dated one at its distance from the parent', () => {
    const kids = [
      task({
        uid: 'k2',
        parentUid: 'p',
        title: 'Second',
        position: 2,
        status: 'done',
        due: '2026-10-04'
      }),
      task({ uid: 'k1', parentUid: 'p', title: 'First', position: 1, status: 'done' })
    ]
    const next = nextOccurrence(weekly, kids, '2026-10-05')
    expect(next?.subtasks.map((s) => s.title)).toEqual(['First', 'Second'])
    expect(next?.subtasks.map((s) => s.due)).toEqual([null, '2026-10-14'])
    expect(next?.subtasks.every((s) => s.status === undefined)).toBe(true)
  })

  it('drops subtask dates when the parent had no date', () => {
    const undated = { ...weekly, due: null }
    const next = nextOccurrence(
      undated,
      [task({ uid: 'k', parentUid: 'p', due: '2026-10-04' })],
      '2026-10-05'
    )
    expect(next?.subtasks[0].due).toBeNull()
  })

  it('is nothing for a task that does not repeat, or for a subtask', () => {
    expect(nextOccurrence(task({ recurrence: null }), [], '2026-10-05')).toBeNull()
    expect(nextOccurrence({ ...weekly, parentUid: 'z' }, [], '2026-10-05')).toBeNull()
  })
})
