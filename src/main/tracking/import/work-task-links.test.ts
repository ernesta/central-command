import { describe, expect, it } from 'vitest'
import { year } from '@shared/tracking/test-utils'
import { linkEntries, planTaskLinks, type LinkEntry, type LinkTask } from './work-task-links'

const task = (uid: string, title: string, minutes: number, date: string): LinkTask => ({
  uid,
  title,
  minutes,
  date
})
let n = 0
const entry = (date: string, label: string, minutes: number): LinkEntry => ({
  key: `e${++n}`,
  date,
  label,
  minutes
})
const linkedTo = (plan: ReturnType<typeof planTaskLinks>, uid: string): number[] =>
  plan.links.find((l) => l.task.uid === uid)?.entries.map((e) => e.minutes) ?? []

describe('planTaskLinks', () => {
  it('links entries whose minutes add up to the task’s time, with different wording', () => {
    const plan = planTaskLinks(
      [task('a', 'Complete SALP Data System audit', 150, '2025-10-25')],
      [
        entry('2025-10-19', 'Luminos Existing Data System Audit: SALP Data System', 120),
        entry('2025-10-25', 'Luminos Existing Data System Audit: SALP Data System', 30)
      ]
    )
    expect(plan.links).toHaveLength(1)
    expect(linkedTo(plan, 'a').sort((x, y) => x - y)).toEqual([30, 120])
  })

  it('never links entries whose minutes do not add up exactly', () => {
    const plan = planTaskLinks(
      [task('a', 'Review SQL database documentation', 75, '2025-12-08')],
      [entry('2025-12-08', 'SQL documentation review', 60)]
    )
    expect(plan.links).toEqual([])
    expect(plan.unmatched.map((t) => t.uid)).toEqual(['a'])
  })

  it('uses dates to pick between tasks with the same title', () => {
    const plan = planTaskLinks(
      [
        task('first', 'Prepare for and complete meeting with Matthew', 90, '2025-10-20'),
        task('second', 'Prepare for and complete meeting with Matthew', 90, '2025-11-17')
      ],
      [
        entry('2025-11-17', 'Meeting with Matthew, synthesizing notes', 90),
        entry('2025-10-20', 'Meeting with Matthew, synthesizing notes', 90)
      ]
    )
    const date = (uid: string): string | undefined =>
      plan.links.find((l) => l.task.uid === uid)?.entries[0].date
    expect(date('first')).toBe('2025-10-20')
    expect(date('second')).toBe('2025-11-17')
  })

  it('links an entry to one task only', () => {
    const plan = planTaskLinks(
      [
        task('a', 'Review program tracker documentation', 60, '2025-12-08'),
        task('b', 'Review program tracker documentation', 60, '2025-12-08')
      ],
      [entry('2025-12-08', 'Program tracker documentation review', 60)]
    )
    expect(plan.links).toHaveLength(0)
    expect(plan.ambiguous).toHaveLength(2)
  })

  it('ignores an entry that is far from the due date or about something else', () => {
    const plan = planTaskLinks(
      [task('a', 'Review program tracker documentation', 60, '2025-12-08')],
      [
        entry('2025-06-01', 'Program tracker documentation review', 60),
        entry('2025-12-08', 'Azure costs export', 60)
      ]
    )
    expect(plan.links).toEqual([])
  })

  it('leaves tasks with no ClickUp time out', () => {
    const plan = planTaskLinks(
      [task('a', 'Set up ClickUp', 0, '2025-10-05')],
      [entry('2025-10-05', 'Set up ClickUp', 30)]
    )
    expect(plan.links).toEqual([])
    expect(plan.unmatched).toEqual([])
  })
})

describe('linkEntries', () => {
  const base = (): ReturnType<typeof year> =>
    year({
      adjusts: [
        { id: 'a', date: '2025-10-06', label: 'Meeting', minutes: 105, client: 'Impact' },
        { id: 'b', date: '2025-10-07', label: 'Other', minutes: 30, client: 'Impact' }
      ]
    })

  it('adds only the task and the earlier flag, nothing else', () => {
    const r = linkEntries(base(), [{ id: 'a', uid: 't1' }])
    expect(r.ok && r.year.adjusts).toEqual([
      {
        id: 'a',
        date: '2025-10-06',
        label: 'Meeting',
        minutes: 105,
        client: 'Impact',
        task: 'cc://task/t1',
        earlier: true
      },
      base().adjusts[1]
    ])
  })

  it('refuses an entry that is already linked or missing, and changes nothing', () => {
    const once = linkEntries(base(), [{ id: 'a', uid: 't1' }])
    if (!once.ok) throw new Error('setup')
    expect(linkEntries(once.year, [{ id: 'a', uid: 't2' }])).toEqual({
      ok: false,
      reason: 'already-linked'
    })
    expect(linkEntries(base(), [{ id: 'zzz', uid: 't1' }])).toEqual({
      ok: false,
      reason: 'missing-entry'
    })
    expect(
      linkEntries(base(), [
        { id: 'a', uid: 't1' },
        { id: 'a', uid: 't2' }
      ])
    ).toEqual({
      ok: false,
      reason: 'duplicate-entry'
    })
  })
})
