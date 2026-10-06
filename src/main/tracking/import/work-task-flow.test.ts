import { describe, expect, it } from 'vitest'
import { allocateByFlow } from './work-task-flow'
import type { LinkEntry, LinkTask } from './work-task-links'

const task = (uid: string, title: string, minutes: number, date: string): LinkTask => ({
  uid,
  title,
  minutes,
  date,
  billable: true
})
const entry = (key: string, date: string, label: string, minutes: number): LinkEntry => ({
  key,
  date,
  label,
  minutes
})
const give = (a: ReturnType<typeof allocateByFlow>, uid: string): number =>
  a.filter((x) => x.task.uid === uid).reduce((n, x) => n + x.minutes, 0)

describe('allocateByFlow', () => {
  it('splits one entry between the tasks it feeds', () => {
    const a = allocateByFlow(
      [
        task('t1', 'Draft developer terms of reference', 60, '2026-06-21'),
        task('t2', 'Review developer terms of reference feedback', 30, '2026-06-21')
      ],
      [entry('e', '2026-06-20', 'Document automation: developer terms of reference', 90)]
    )
    expect(give(a, 't1')).toBe(60)
    expect(give(a, 't2')).toBe(30)
  })

  it('adds several entries together for one task', () => {
    const a = allocateByFlow(
      [task('t', 'Review developer proposals', 90, '2026-09-30')],
      [
        entry('a', '2026-09-23', 'Developer proposal review', 45),
        entry('b', '2026-09-29', 'Developer proposal review', 45)
      ]
    )
    expect(give(a, 't')).toBe(90)
  })

  it('never gives more than an entry has or a task needs', () => {
    const a = allocateByFlow(
      [task('t', 'Review developer proposals', 30, '2026-09-30')],
      [entry('a', '2026-09-23', 'Developer proposal review', 90)]
    )
    expect(give(a, 't')).toBe(30)
  })

  it('leaves out pairs that share no words or are far apart in time', () => {
    const a = allocateByFlow(
      [task('t', 'Review developer proposals', 30, '2026-09-30')],
      [
        entry('a', '2026-09-23', 'Azure costs export', 30),
        entry('b', '2025-01-01', 'Developer proposal review', 30)
      ]
    )
    expect(a).toEqual([])
  })
})
