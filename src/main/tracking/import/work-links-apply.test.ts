import { describe, expect, it } from 'vitest'
import { applyEntryLinks, markEarlier, planFinal, type ApplyTask } from './work-links-apply'
import { year } from '@shared/tracking/test-utils'
import { parseChanges, parseWorksheet, taskNames, type SheetEntry } from './work-links-sheet'

const task = (
  uid: string,
  title: string,
  minutes: number,
  date: string,
  tags: string[] = ['billable']
): ApplyTask => ({
  uid,
  title,
  minutes,
  date,
  billable: true,
  list: 'Luminos',
  sublist: 'Document Automation',
  status: 'done',
  tags,
  parentUid: null
})
const entry = (
  key: string,
  date: string,
  label: string,
  minutes: number,
  kind: 'typed' | 'timer' = 'typed'
): SheetEntry => ({
  key,
  date,
  label,
  minutes,
  client: 'Impact',
  kind
})
const run = (
  tasks: ApplyTask[],
  entries: SheetEntry[],
  sheet: string,
  changes = 'action,task,to,minutes,sublist'
): ReturnType<typeof planFinal> =>
  planFinal({
    tasks,
    names: taskNames(tasks),
    entries,
    rows: parseWorksheet(`id,minutes,task\n${sheet}`).rows,
    changes: parseChanges(changes).changes
  })

describe('planFinal', () => {
  it('renames a task to its entry, dates it on the last entry and marks the entries as already in ClickUp', () => {
    const p = run(
      [task('a', 'Draft TORs', 150, '2026-07-12', [])],
      [
        entry('y/1', '2026-06-20', 'developer terms of reference', 60),
        entry('y/2', '2026-07-12', 'Developer terms of reference', 90)
      ],
      'y/1,60,Draft TORs\ny/2,90,Draft TORs'
    )
    expect(p.problems).toEqual([])
    expect(p.tasks[0]).toMatchObject({
      target: 'a',
      oldTitle: 'Draft TORs',
      title: 'Developer terms of reference',
      due: '2026-07-12',
      earlier: 150,
      tagBillable: true
    })
    expect(p.links.every((l) => l.earlier)).toBe(true)
  })

  it('keeps a task’s name when its entries are worded differently, and takes the shared wording otherwise', () => {
    const p = run(
      [
        task('a', 'Classroom Observation Data: loading', 90, '2026-03-24', []),
        task('b', 'Plan', 30, '2026-03-25', [])
      ],
      [
        entry('y/1', '2026-03-01', 'Liberia 2022-23', 45),
        entry('y/2', '2026-03-02', 'Ghana 2021-22', 45),
        entry('y/3', '2026-03-03', 'Planning', 15),
        entry('y/4', '2026-03-04', 'planning', 15)
      ],
      'y/1,45,Classroom Observation Data: loading\ny/2,45,Classroom Observation Data: loading\ny/3,15,Plan\ny/4,15,Plan'
    )
    expect(p.tasks.map((t) => t.title)).toEqual(['Classroom Observation Data: loading', 'Planning'])
  })

  it('makes a task for a new name, with hours only (not already in ClickUp), done and billable', () => {
    const p = run(
      [],
      [entry('y/1', '2026-10-05', 'developer contract preparation', 30)],
      'y/1,30,NEW: Developer contract preparation [Document Automation]'
    )
    expect(p.problems).toEqual([])
    expect(p.tasks[0]).toMatchObject({
      existing: false,
      earlier: 0,
      sublist: 'Document Automation',
      status: 'done',
      tagBillable: true,
      due: '2026-10-05'
    })
    expect(p.links[0].earlier).toBe(false)
  })

  it('splits, merges and moves ClickUp time so each task equals its hours, and retires a merged task', () => {
    const tasks = [
      task('a', 'A', 90, '2026-01-01'),
      task('b', 'B', 30, '2026-01-02'),
      task('c', 'C', 15, '2026-01-03')
    ]
    // A keeps 60 and splits 30 off; C joins B (45); 15 of the split moves to B (60); the split keeps 15.
    const changes =
      'action,task,to,minutes,sublist\nsplit,A,A part two,30,\nmerge,C,B\nmove,A part two,B,15'
    const p = run(
      tasks,
      [
        entry('y/1', '2026-01-01', 'one', 60),
        entry('y/2', '2026-01-04', 'two', 15),
        entry('y/3', '2026-01-05', 'three', 60)
      ],
      'y/1,60,A\ny/2,15,A part two\ny/3,60,B',
      changes
    )
    expect(p.problems).toEqual([])
    expect(p.retire).toEqual(['c'])
    const by = Object.fromEntries(p.tasks.map((t) => [t.title, t.earlier]))
    expect(by).toEqual({ one: 60, two: 15, three: 60 })
  })

  it('never lets a timer fill ClickUp time, and refuses a task whose ClickUp time differs from its hours', () => {
    const t = [task('a', 'Liberia', 60, '2026-10-04')]
    const timer = entry('y/t', '2026-10-05', 'Liberia', 135, 'timer')
    const ok = run(
      t,
      [entry('y/1', '2026-10-04', 'Liberia', 60), timer],
      'y/1,60,Liberia\ny/t,135,Liberia'
    )
    expect(ok.problems).toEqual([])
    expect(ok.links.find((l) => l.key === 'y/t')?.earlier).toBe(false)
    const bad = run(t, [entry('y/1', '2026-10-04', 'Liberia', 45)], 'y/1,45,Liberia')
    expect(bad.problems[0]).toMatch(/ClickUp 1:00 but typed hours 0:45/)
  })

  it('reports an entry with no task or two rows, and ClickUp time left without hours', () => {
    const t = [task('a', 'A', 30, '2026-01-01')]
    const e = [entry('y/1', '2026-01-01', 'one', 30), entry('y/2', '2026-01-02', 'two', 15)]
    expect(run(t, e, 'y/1,30,A').problems[0]).toMatch(/no task/)
    expect(run(t, e, 'y/1,15,A\ny/1,15,A\ny/2,15,A').problems.join()).toMatch(/more than one row/)
    expect(
      run(t, [entry('y/2', '2026-01-02', 'two', 15)], 'y/2,15,NEW: Two [X]').problems.join()
    ).toMatch(/keeps 0:30 of ClickUp time/)
  })
})

describe('applyEntryLinks', () => {
  const base = (): ReturnType<typeof year> =>
    year({
      adjusts: [{ id: 'a', date: '2026-01-01', label: 'x', minutes: 60 }],
      sessions: [
        { id: 's', date: '2026-10-05', start: '09:00:00', end: '10:00:00', minutes: 60, label: 'y' }
      ]
    })

  it('links typed entries (with earlier when ClickUp holds them) and timer sessions (never earlier)', () => {
    const r = applyEntryLinks(base(), [
      { id: 'a', task: 'cc://task/t', earlier: true },
      { id: 's', task: 'cc://task/u', earlier: false }
    ])
    expect(r.ok && r.year.adjusts[0]).toMatchObject({
      task: 'cc://task/t',
      earlier: true,
      minutes: 60
    })
    expect(r.ok && r.year.sessions[0]).toMatchObject({ task: 'cc://task/u' })
  })

  it('changes nothing twice, and refuses a conflict, a missing id or a timer marked earlier', () => {
    const once = applyEntryLinks(base(), [{ id: 'a', task: 'cc://task/t', earlier: true }])
    if (!once.ok) throw new Error('setup')
    expect(
      applyEntryLinks(once.year, [{ id: 'a', task: 'cc://task/t', earlier: true }])
    ).toMatchObject({ ok: true })
    expect(
      applyEntryLinks(once.year, [{ id: 'a', task: 'cc://task/other', earlier: true }])
    ).toEqual({ ok: false, reason: 'already-linked' })
    expect(applyEntryLinks(base(), [{ id: 'zz', task: 'cc://task/t', earlier: false }])).toEqual({
      ok: false,
      reason: 'missing-entry'
    })
    expect(applyEntryLinks(base(), [{ id: 's', task: 'cc://task/t', earlier: true }])).toEqual({
      ok: false,
      reason: 'already-linked'
    })
  })
})

describe('markEarlier', () => {
  const linked = (): ReturnType<typeof year> =>
    year({
      adjusts: [
        { id: 'a', date: '2026-01-01', label: 'x', minutes: 30, task: 'cc://task/t' },
        { id: 'b', date: '2026-01-02', label: 'y', minutes: 15 }
      ]
    })
  it('marks a linked typed entry and nothing else, and refuses an unlinked or missing one', () => {
    const r = markEarlier(linked(), ['a'])
    expect(r.ok && r.year.adjusts).toMatchObject([
      { id: 'a', earlier: true, minutes: 30 },
      { id: 'b' }
    ])
    expect(r.ok && r.year.adjusts[1].earlier).toBeUndefined()
    expect(markEarlier(linked(), ['b'])).toEqual({ ok: false, reason: 'not-linked' })
    expect(markEarlier(linked(), ['zz'])).toEqual({ ok: false, reason: 'missing-entry' })
  })
})
