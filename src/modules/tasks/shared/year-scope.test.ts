import { describe, expect, it } from 'vitest'
import { inYearScope, taskInYearScope } from './year-scope'
import { task } from './test-utils'
import type { Task } from './types'

// 2025–26 runs 22 Sep 2025 to 20 Sep 2026; 2026–27 starts on 21 Sep 2026.
const Y25 = '2025-09-22'
const Y26 = '2026-09-21'

const due = (date: string | null, over: Partial<Task> = {}): Task => task({ due: date, ...over })

describe('a task under one academic year', () => {
  it('shows when its due date is in the year, on its first and its last day', () => {
    expect(taskInYearScope(due('2026-09-21'), [], Y26)).toBe(true)
    expect(taskInYearScope(due('2027-09-19'), [], Y26)).toBe(true)
    expect(taskInYearScope(due('2025-09-22'), [], Y25)).toBe(true)
    expect(taskInYearScope(due('2026-09-20'), [], Y25)).toBe(true)
  })

  it('does not show for a due date in a later year, and a done task from an earlier one stays in its own', () => {
    expect(taskInYearScope(due('2027-09-20'), [], Y26)).toBe(false)
    expect(taskInYearScope(due('2026-09-21'), [], Y25)).toBe(false)
    expect(taskInYearScope(due('2026-09-20', { status: 'done' }), [], Y26)).toBe(false)
  })

  it('always shows with no due date, open or done', () => {
    expect(taskInYearScope(due(null), [], Y26)).toBe(true)
    expect(taskInYearScope(due(null, { status: 'done' }), [], Y25)).toBe(true)
  })

  it('shows when open and late from an earlier year, whether todo or doing', () => {
    expect(taskInYearScope(due('2026-09-20'), [], Y26)).toBe(true)
    expect(taskInYearScope(due('2024-01-05', { status: 'doing' }), [], Y26)).toBe(true)
  })

  it('takes the date of its earliest open subtask when it has none of its own', () => {
    const kid = task({ uid: 'k', parentUid: 'p', due: '2026-10-01' })
    const doneKid = task({ uid: 'd', parentUid: 'p', due: '2025-10-01', status: 'done' })
    expect(taskInYearScope(due(null), [kid], Y26)).toBe(true)
    expect(taskInYearScope(due(null), [kid], Y25)).toBe(false)
    // A done subtask's date does not count: the task is undated.
    expect(taskInYearScope(due(null), [doneKid], Y26)).toBe(true)
    // Its own date is never replaced by a subtask's.
    expect(taskInYearScope(due('2025-10-01', { status: 'done' }), [kid], Y26)).toBe(false)
  })
})

describe('inYearScope', () => {
  const rows = [
    { task: task({ uid: 'a', due: '2026-10-05' }), kids: [] },
    { task: task({ uid: 'b', due: '2025-10-05' }), kids: [] },
    { task: task({ uid: 'c', due: null }), kids: [] },
    { task: task({ uid: 'd', due: '2025-10-05', status: 'done' as const }), kids: [] }
  ]

  it('keeps every row under All years', () => {
    expect(inYearScope(rows, 'all').map((r) => r.task.uid)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps the year’s rows, the undated, and the open late ones under one year', () => {
    expect(inYearScope(rows, Y26).map((r) => r.task.uid)).toEqual(['a', 'b', 'c'])
    expect(inYearScope(rows, Y25).map((r) => r.task.uid)).toEqual(['b', 'c', 'd'])
  })
})
