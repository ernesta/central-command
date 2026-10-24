import { describe, expect, it } from 'vitest'
import { task } from '../shared/test-utils'
import type { Task } from '../shared/types'
import { plainRequest, searchRequest, type SearchRequest } from '@shared/search-query'
import { taskHits } from './search'

describe('taskHits', () => {
  const today = '2026-10-05'
  const req = (text: string): SearchRequest => ({ ...plainRequest(text), today })
  const tasks = [
    task({ uid: 'a', title: 'Write methods', due: '2026-10-09' }),
    task({ uid: 'b', title: 'Write intro', due: '2026-10-07' }),
    task({ uid: 'c', title: 'Write old', status: 'done', due: '2026-01-01' }),
    task({ uid: 'd', title: 'Other', description: 'something about methods here' }),
    task({ uid: 'e', title: 'Kid', parentUid: 'a' })
  ]
  it('finds every word in the title, tags, list or description, open and soonest first, done last', () => {
    expect(taskHits(tasks, req('write'), 6).map((h) => h.key)).toEqual(['b', 'a', 'c'])
    expect(taskHits(tasks, req('methods'), 6).map((h) => h.key)).toEqual(['a', 'd'])
  })
  it('shows the matching text from the description, else the list and date; a subtask names its parent', () => {
    const hits = taskHits(tasks, req('methods'), 6)
    expect(hits[0].detail).toBe('Reading · Oct 9')
    expect(hits[1].detail).toContain('methods')
    expect(taskHits(tasks, req('kid'), 6)[0].detail).toBe('Subtask of Write methods')
  })
  it('shows a self-study subtask with its series in front', () => {
    const rows = [
      task({ uid: 'p', title: 'Simulating Social Worlds self-study' }),
      task({ uid: 'c', title: 'Day 2 self-study', parentUid: 'p', ownKind: 'self-study' })
    ]
    expect(taskHits(rows, req('day 2'), 6)[0].title).toBe(
      'Simulating Social Worlds › Day 2 self-study'
    )
  })
  it('marks an open task whose date has passed as late, not a done one', () => {
    const rows = [
      task({ uid: 'l', title: 'Old open', due: '2026-10-01' }),
      task({ uid: 'd', title: 'Old done', due: '2026-10-01', status: 'done' }),
      task({ uid: 'n', title: 'Old soon', due: '2026-10-09' })
    ]
    const hits = taskHits(rows, req('old'), 6)
    expect(hits.map((h) => [h.key, h.late])).toEqual([
      ['l', 4],
      ['n', undefined],
      ['d', undefined]
    ])
  })
  it('respects the limit', () => {
    expect(taskHits(tasks, req('write'), 2)).toHaveLength(2)
  })
})

describe('taskHits with modifiers', () => {
  const today = '2026-10-19' // a Monday
  const run = (query: string, rows: Task[] = tasks): string[] =>
    taskHits(rows, searchRequest(query, today), 40).map((h) => h.key)
  const tasks = [
    task({ uid: 'a', title: 'Alpha', status: 'todo', priority: 'high', due: '2026-10-19' }),
    task({ uid: 'b', title: 'Beta', status: 'doing', priority: 'normal', due: '2026-10-20' }),
    task({
      uid: 'c',
      title: 'Gamma',
      status: 'done',
      priority: 'low',
      due: '2026-10-01',
      list: 'Luminos',
      sublist: 'Report',
      tags: ['Stats']
    }),
    task({ uid: 'd', title: 'Delta', due: '2026-10-10', list: 'Luminos', description: 'notes' }),
    task({ uid: 'e', title: 'Epsilon', due: null }),
    task({ uid: 'f', title: 'Kid', parentUid: 'c', list: '', tags: ['kid'] }),
    task({ uid: 'g', title: 'Zeta', due: '2026-10-26' })
  ]

  it('status: by the label shown, and open is to do plus in progress', () => {
    expect(run('status:"to do"').sort()).toEqual(['a', 'd', 'e', 'f', 'g'])
    expect(run('status:"in progress"')).toEqual(['b'])
    expect(run('status:done')).toEqual(['c'])
    expect(run('status:open')).toEqual(expect.arrayContaining(['a', 'b', 'd', 'e', 'f', 'g']))
    expect(run('status:open')).not.toContain('c')
  })

  it('priority: P1, P2, P3 for high, normal, low', () => {
    expect(run('priority:P1')).toEqual(['a'])
    expect(run('priority:p3')).toEqual(['c'])
    expect(run('priority:p2')).toContain('b')
    expect(run('priority:p2')).not.toContain('a')
  })

  it('due: today, tomorrow, overdue (open only), week (today plus six days)', () => {
    expect(run('due:today')).toEqual(['a'])
    expect(run('due:tomorrow')).toEqual(['b'])
    expect(run('due:overdue')).toEqual(['d'])
    expect(run('due:week').sort()).toEqual(['a', 'b'])
    expect(run('-due:overdue')).not.toContain('d')
  })

  it('a task with no due date matches -due:today and none of the positive ones', () => {
    expect(run('-due:today')).toContain('e')
    for (const q of [
      'due:today',
      'due:overdue',
      'due:week',
      'has:due',
      'after:2000',
      'during:2026'
    ])
      expect(run(q)).not.toContain('e')
  })

  it('list: a top-level list, or list/sublist; a subtask has its parent’s', () => {
    expect(run('list:luminos').sort()).toEqual(['c', 'd', 'f'])
    expect(run('list:"Luminos/Report"').sort()).toEqual(['c', 'f'])
    expect(run('list:Luminos/Other')).toEqual([])
    expect(run('-list:luminos')).not.toContain('c')
  })

  it('tag: exact, ignoring case', () => {
    expect(run('tag:stats')).toEqual(['c'])
    expect(run('tag:sta')).toEqual([])
    expect(run('-tag:stats')).not.toContain('c')
    expect(run('-tag:stats')).toContain('a')
  })

  it('has:due and has:description', () => {
    expect(run('has:description')).toEqual(['d'])
    expect(run('has:due')).not.toContain('e')
    expect(run('-has:due')).toEqual(expect.arrayContaining(['e', 'f']))
    expect(run('-has:due')).not.toContain('a')
  })

  it('dates are the due date', () => {
    expect(run('before:2026-10-02')).toEqual(['c'])
    expect(run('after:2026-10-20')).toEqual(['g'])
    expect(run('on:2026-10-20')).toEqual(['b'])
    expect(run('during:"this week"').sort()).toEqual(['a', 'b'])
    expect(run('after:2026-10-01 before:2026-10-15')).toEqual(['d'])
  })

  it('ANDs modifiers and words', () => {
    expect(run('status:open priority:p1')).toEqual(['a'])
    expect(run('status:open list:luminos')).toEqual(['d', 'f'])
    expect(run('list:luminos alpha')).toEqual([])
  })

  it('a repeated multi-valued modifier needs both (tag:a tag:b)', () => {
    const rows = [task({ uid: 'x', tags: ['a', 'b'] }), task({ uid: 'y', tags: ['a'] })]
    expect(run('tag:a tag:b', rows)).toEqual(['x'])
  })

  it('finds quoted phrases only as written', () => {
    const rows = [
      task({ uid: 'x', title: 'Effect size notes' }),
      task({ uid: 'y', title: 'Size of effect' })
    ]
    expect(run('"effect size"', rows)).toEqual(['x'])
  })

  it('lists everything the modifiers match when there are no words', () => {
    expect(run('status:done')).toEqual(['c'])
  })
})
