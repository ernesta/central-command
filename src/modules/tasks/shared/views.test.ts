import { describe, expect, it } from 'vitest'
import { task } from './test-utils'
import type { Task } from './types'
import {
  effectiveDue,
  groupTasks,
  inView,
  isBacklog,
  isOpen,
  landingSections,
  listSummaries,
  subtaskProgress,
  taskTime,
  type TaskRow
} from './views'

const TODAY = '2026-10-05'
const row = (over: Partial<Task> = {}, kids: Task[] = []): TaskRow => ({ task: task(over), kids })

describe('effectiveDue', () => {
  it('is the task’s own date, never replaced by a subtask’s', () => {
    const t = task({ due: '2026-10-09' })
    expect(effectiveDue(t, [task({ uid: 'k', due: '2026-10-06' })])).toBe('2026-10-09')
  })
  it('takes the earliest date of open subtasks when the task has none', () => {
    const kids = [
      task({ uid: 'k1', due: '2026-10-12' }),
      task({ uid: 'k2', due: '2026-10-07' }),
      task({ uid: 'k3', due: '2026-10-01', status: 'done' })
    ]
    expect(effectiveDue(task(), kids)).toBe('2026-10-07')
  })
  it('is null with nothing dated', () => {
    expect(effectiveDue(task(), [task({ uid: 'k' })])).toBeNull()
  })
})

describe('views', () => {
  it('Open is dated or in progress; Backlog is to do with no date; Done is done', () => {
    const dated = row({ due: '2026-10-09' })
    const undated = row()
    const doing = row({ status: 'doing' })
    const done = row({ status: 'done', due: '2026-10-09' })
    expect([dated, undated, doing, done].map(isOpen)).toEqual([true, false, true, false])
    expect([dated, undated, doing, done].map(isBacklog)).toEqual([false, true, false, false])
    expect(inView(done, 'done')).toBe(true)
    expect(inView(undated, 'backlog')).toBe(true)
  })
  it('a task with a dated open subtask is open, not backlog', () => {
    const r = { task: task(), kids: [task({ uid: 'k', due: '2026-10-08' })] }
    expect(isOpen(r)).toBe(true)
    expect(isBacklog(r)).toBe(false)
  })
})

describe('groupTasks', () => {
  it('makes rows of top-level tasks only, subtasks in position order', () => {
    const all = [
      task({ uid: 'p' }),
      task({ uid: 'k2', parentUid: 'p', position: 2 }),
      task({ uid: 'k1', parentUid: 'p', position: 1 }),
      task({ uid: 'orphan', parentUid: 'gone' })
    ]
    const rows = groupTasks(all)
    expect(rows.map((r) => r.task.uid)).toEqual(['p'])
    expect(rows[0].kids.map((k) => k.uid)).toEqual(['k1', 'k2'])
  })
})

describe('landingSections', () => {
  it('puts a task once, under the first heading that fits', () => {
    const rows = [
      row({ uid: 'a', due: TODAY, status: 'doing' }),
      row({ uid: 'b', due: '2026-10-01', status: 'doing' }),
      row({ uid: 'c', due: '2026-10-01' }),
      row({ uid: 'd', due: '2026-10-19' }),
      row({ uid: 'e', due: '2026-10-20' }),
      row({ uid: 'f', due: '2026-10-06' }),
      row({ uid: 'g' }),
      row({ uid: 'h', due: TODAY, status: 'done' })
    ]
    const s = landingSections(rows, TODAY)
    const ids = (k: keyof typeof s): string[] => s[k].map((r) => r.task.uid)
    expect(ids('today')).toEqual(['a'])
    expect(ids('doing')).toEqual(['b'])
    expect(ids('overdue')).toEqual(['c'])
    expect(ids('upcoming')).toEqual(['f', 'd'])
  })

  it('lists a task for a subtask’s own date, with that subtask nested', () => {
    const kid = task({ uid: 'k', parentUid: 'p', due: TODAY })
    const other = task({ uid: 'k2', parentUid: 'p' })
    const s = landingSections(
      [{ task: task({ uid: 'p', due: '2026-10-09' }), kids: [kid, other] }],
      TODAY
    )
    expect(s.today.map((r) => r.task.uid)).toEqual(['p'])
    expect(s.today[0].nested.map((k) => k.uid)).toEqual(['k'])
    expect(s.upcoming).toEqual([])
  })

  it('ignores a done subtask’s date', () => {
    const kid = task({ uid: 'k', parentUid: 'p', due: TODAY, status: 'done' })
    const s = landingSections([{ task: task({ uid: 'p' }), kids: [kid] }], TODAY)
    expect(s.today).toEqual([])
  })

  it('orders by date, then priority', () => {
    const s = landingSections(
      [
        row({ uid: 'low', due: '2026-10-01', priority: 'low' }),
        row({ uid: 'high', due: '2026-10-01', priority: 'high' }),
        row({ uid: 'older', due: '2026-09-01', priority: 'low' })
      ],
      TODAY
    )
    expect(s.overdue.map((r) => r.task.uid)).toEqual(['older', 'high', 'low'])
  })
})

describe('listSummaries', () => {
  it('counts tasks not done per list, overdue ones, and the sublists', () => {
    const rows = [
      row({ uid: 'a', list: 'Study 2', sublist: 'Data', due: '2026-10-01' }),
      row({ uid: 'b', list: 'Study 2', sublist: 'Scoping' }),
      row({ uid: 'c', list: 'Reading', status: 'done' }),
      row({ uid: 'd', list: 'Admin' })
    ]
    expect(listSummaries(rows, TODAY)).toEqual([
      { list: 'Study 2', open: 2, overdue: 1, sublists: ['Data', 'Scoping'] },
      { list: 'Admin', open: 1, overdue: 0, sublists: [] }
    ])
  })
  it('in Work shows every client, one with nothing open as a card with none', () => {
    const rows = [
      row({ uid: 'a', list: 'Impact' }),
      row({ uid: 'b', list: 'Teaching', status: 'done' })
    ]
    expect(listSummaries(rows, TODAY, ['impact', 'Teaching', 'Royal Holloway'])).toEqual([
      { list: 'Impact', open: 1, overdue: 0, sublists: [] },
      { list: 'Royal Holloway', open: 0, overdue: 0, sublists: [] },
      { list: 'Teaching', open: 0, overdue: 0, sublists: [] }
    ])
  })
})

describe('taskTime and subtaskProgress', () => {
  it('rolls subtasks up and keeps ClickUp time apart from Hours', () => {
    const r = {
      task: task({ uid: 'p', earlierMinutes: 60 }),
      kids: [task({ uid: 'k', parentUid: 'p', earlierMinutes: 30, status: 'done' })]
    }
    const t = taskTime(
      r,
      new Map([
        ['p', 15],
        ['k', 5]
      ])
    )
    expect(t).toEqual({ earlier: 90, tracked: 20, total: 110 })
    expect(subtaskProgress(r.kids)).toEqual({ done: 1, total: 1 })
  })
})
