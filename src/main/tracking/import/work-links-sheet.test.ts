import { describe, expect, it } from 'vitest'
import {
  applyChanges,
  buildRows,
  checkWorksheet,
  formatWorksheet,
  parseChanges,
  parseNewTask,
  parseWorksheet,
  ruleRows,
  taskNames,
  type SheetEntry,
  type SheetTask
} from './work-links-sheet'

const task = (uid: string, title: string, minutes: number, date: string): SheetTask => ({
  uid,
  title,
  minutes,
  date,
  billable: true,
  list: 'Luminos',
  sublist: 'Document Automation'
})
const entry = (key: string, date: string, label: string, minutes: number): SheetEntry => ({
  key,
  date,
  label,
  minutes,
  client: 'Impact',
  kind: 'typed'
})

const tasks = [
  task('a', 'Draft TORs', 90, '2026-07-12'),
  task('b', 'Prepare for meeting', 30, '2026-07-01'),
  task('c', 'Prepare for meeting', 45, '2026-08-01')
]
const entries = [
  entry('y/1', '2026-07-10', 'Document automation: developer terms of reference', 90),
  entry('y/2', '2026-10-05', 'Document automation: task planning', 135)
]
const names = taskNames(tasks)
const billable = new Set(['a', 'b', 'c'])
const sheet = (rows: string): string => `id,minutes,task\n${rows}`
const check = (rows: string): ReturnType<typeof checkWorksheet> =>
  checkWorksheet(parseWorksheet(sheet(rows)), entries, tasks, names, billable)

describe('the worksheet', () => {
  it('names a task by its title, adding the due date only when titles repeat', () => {
    expect(names.get('a')).toBe('Draft TORs')
    expect(names.get('b')).toBe('Prepare for meeting (due 2026-07-01)')
    expect(names.get('c')).toBe('Prepare for meeting (due 2026-08-01)')
  })

  it('pre-fills exact links, and writes a row for what is left with a suggestion', () => {
    const rows = buildRows(
      entries,
      tasks,
      [{ task: tasks[0], entries: [entries[0]], confidence: 'high' }],
      [],
      names
    )
    expect(rows.map((r) => [r.id, r.task])).toEqual([
      ['y/1', 'Draft TORs'],
      ['y/2', '']
    ])
    expect(formatWorksheet(rows).split('\n')[0]).toBe(
      'id,date,client,hours,minutes,label,task,note'
    )
  })

  it('reads a new task, with its sublist', () => {
    expect(parseNewTask('NEW: Task planning [Document Automation]')).toEqual({
      title: 'Task planning',
      sublist: 'Document Automation'
    })
    expect(parseNewTask('Draft TORs')).toBeNull()
  })
})

describe('checkWorksheet', () => {
  it('is not complete while a billable task with time is short, even when every entry has a task', () => {
    const r = check('y/1,90,Draft TORs\ny/2,135,NEW: Task planning [Document Automation]')
    expect(r.problems).toEqual([])
    expect(r.newTasks).toMatchObject([{ title: 'Task planning', minutes: 135 }])
    expect(r.tasks.find((t) => t.task.uid === 'b')?.fit).toBe('short')
    expect(r.complete).toBe(false)
  })

  it('says what is short and what is over', () => {
    const r = check('y/1,60,Draft TORs\ny/1,30,Prepare for meeting (due 2026-07-01)\ny/2,135,-')
    expect(r.tasks.find((t) => t.task.uid === 'a')).toMatchObject({ fit: 'short', assigned: 60 })
    expect(r.tasks.find((t) => t.task.uid === 'b')).toMatchObject({ fit: 'exact' })
    expect(r.noTask).toEqual([{ id: 'y/2', minutes: 135 }])
  })

  it('lists entries with no row or an empty task, and refuses rows that do not add up to the entry', () => {
    expect(check('y/1,90,Draft TORs').unassigned).toEqual([{ id: 'y/2', minutes: 135 }])
    expect(check('y/1,60,Draft TORs\ny/2,135,-').problems[0]).toMatch(/add up to 1:00/)
  })

  it('flags a name that is no task, an unknown entry and a task that is not billable', () => {
    expect(check('y/1,90,Nothing like it\ny/2,135,-').problems[0]).toMatch(/no task called/)
    expect(check('zzz,15,-').problems[0]).toMatch(/no entry/)
    const r = checkWorksheet(
      parseWorksheet(sheet('y/1,90,Draft TORs\ny/2,135,-')),
      entries,
      tasks,
      names,
      new Set(['b', 'c'])
    )
    expect(r.notBillable).toHaveLength(1)
    expect(r.complete).toBe(false)
  })

  it('accepts hours that exceed a task’s ClickUp time, but not a task with more ClickUp time than hours', () => {
    const two = [task('a', 'Draft TORs', 60, '2026-07-12'), task('b', 'Plan', 135, '2026-10-05')]
    const run = (rows: string): ReturnType<typeof checkWorksheet> =>
      checkWorksheet(parseWorksheet(sheet(rows)), entries, two, taskNames(two), new Set(['a', 'b']))
    expect(run('y/1,90,Draft TORs\ny/2,135,Plan').complete).toBe(true)
    const short = run('y/1,90,Plan\ny/2,135,-')
    expect(short.tasks.find((t) => t.task.uid === 'a')?.fit).toBe('short')
    expect(short.complete).toBe(false)
  })

  it('is complete when every entry is placed and every billable task adds up exactly', () => {
    const two = [task('a', 'Draft TORs', 90, '2026-07-12'), task('b', 'Plan', 135, '2026-10-05')]
    const r = checkWorksheet(
      parseWorksheet(sheet('y/1,90,Draft TORs\ny/2,135,Plan')),
      entries,
      two,
      taskNames(two),
      new Set(['a', 'b'])
    )
    expect(r.complete).toBe(true)
  })
})

describe('ruleRows', () => {
  const summary = (uid: string, minutes: number, date: string): SheetTask => ({
    ...task(uid, 'Create and send a monthly summary to Matthew', minutes, date),
    sublist: 'Admin & Logistics'
  })
  const log = (key: string, date: string, month: string, client: string): SheetEntry => ({
    ...entry(key, date, `Monthly Activity Log: ${month}`, 15),
    client
  })
  const pool = [
    summary('s1', 30, '2026-07-08'),
    summary('s2', 0, '2026-08-10'),
    summary('s3', 15, '2026-09-25')
  ]
  const nm = taskNames(pool)

  it('puts each activity log on the nearest summary task with ClickUp time to spare, else on one with none, else makes a task', () => {
    const logs = [
      log('l1', '2026-07-07', 'June', 'Impact'),
      log('l2', '2026-07-07', 'June', 'Teaching & Learning'),
      log('l3', '2026-07-30', 'July', 'Impact'),
      log('l4', '2026-09-03', 'August', 'Impact'),
      log('l5', '2026-01-10', 'December', 'Impact')
    ]
    const rows = ruleRows(logs, pool, nm, '2026-10-04')
    expect(rows.map((r) => [r.entry, r.uid ?? r.task])).toEqual([
      ['l5', 'NEW: Submit activity log: December (Impact) [Admin & Logistics]'],
      ['l1', 's1'],
      ['l2', 's1'],
      ['l3', 's2'],
      ['l4', 's3']
    ])
  })

  it('makes a Document Automation task of each entry after the last day ClickUp was used', () => {
    const rows = ruleRows(
      [
        entry('o', '2026-10-05', 'Document automation: task planning', 135),
        entry('p', '2026-10-04', 'Old', 30)
      ],
      pool,
      nm,
      '2026-10-04'
    )
    expect(rows).toMatchObject([{ entry: 'o', task: 'NEW: Task planning [Document Automation]' }])
  })

  it('names a timer’s task, and the check does not let a timer fill ClickUp’s time', () => {
    const t = [task('l', 'Draft a Liberia RAI for the upcoming endline', 60, '2026-10-04')]
    const timer: SheetEntry = {
      ...entry('s', '2026-10-05', 'Liberia RAI for the upcoming endline', 135),
      kind: 'timer'
    }
    expect(ruleRows([timer], t, taskNames(t), '2026-10-04')[0].task).toBe(
      'Draft a Liberia RAI for the upcoming endline'
    )
    const typed = entry('x', '2026-10-04', 'Liberia RAI', 60)
    const name = 'Draft a Liberia RAI for the upcoming endline'
    const r = checkWorksheet(
      parseWorksheet(sheet(`s,135,${name}\nx,60,${name}`)),
      [timer, typed],
      t,
      taskNames(t),
      new Set(['l'])
    )
    expect(r.tasks[0]).toMatchObject({ fit: 'exact', assigned: 60 })
    expect(r.complete).toBe(true)
  })
})

describe('task dates', () => {
  it('moves a task to the day of its last typed entry, and dates a new task the same way', () => {
    const r = check('y/1,90,Draft TORs\ny/2,135,NEW: Task planning [Document Automation]')
    expect(r.dateChanges).toEqual([{ name: 'Draft TORs', from: '2026-07-12', to: '2026-07-10' }])
    expect(r.newTasks[0].due).toBe('2026-10-05')
  })
})

describe('ClickUp task changes', () => {
  const base = [task('u', 'Update TORs and send to developers', 90, '2026-09-02')]
  const nm = taskNames(base)
  const text = (rows: string): string => `action,task,to,minutes,sublist\n${rows}`

  it('splits a task and renames the rest, so each hours entry has a task of exactly its time', () => {
    const { changes, problems } = parseChanges(
      text(
        'split,Update TORs and send to developers,Send TORs to developers,60\nrename,Update TORs and send to developers,Update TORs,,'
      )
    )
    expect(problems).toEqual([])
    const r = applyChanges(base, nm, changes)
    expect(r.problems).toEqual([])
    expect(r.tasks.map((t) => [r.names.get(t.uid), t.minutes])).toEqual([
      ['Update TORs', 30],
      ['Send TORs to developers', 60]
    ])
    expect(r.billable).toHaveLength(1)
  })

  it('refuses a split of all or more than the task has, a missing task and a name already used', () => {
    const run = (rows: string): string[] =>
      applyChanges(base, nm, parseChanges(text(rows)).changes).problems
    expect(run('split,Update TORs and send to developers,X,90')[0]).toMatch(/only 1:30 to split/)
    expect(run('rename,Nothing,X,,')[0]).toMatch(/no task called/)
    expect(
      run('rename,Update TORs and send to developers,Update TORs and send to developers,,')[0]
    ).toMatch(/already exists/)
    expect(parseChanges(text('split,A,B,10')).problems).toHaveLength(1)
  })

  it('lets the check match hours to the new names', () => {
    const r = applyChanges(
      base,
      nm,
      parseChanges(
        text(
          'split,Update TORs and send to developers,Send TORs,60\nrename,Update TORs and send to developers,Update TORs,,'
        )
      ).changes
    )
    const e = [
      entry('y/1', '2026-09-01', 'developer terms of reference', 30),
      entry('y/2', '2026-09-02', 'sharing terms', 60)
    ]
    const c = checkWorksheet(
      parseWorksheet(sheet('y/1,30,Update TORs\ny/2,60,Send TORs')),
      e,
      r.tasks,
      r.names,
      new Set(['u', ...r.billable])
    )
    expect(c.complete).toBe(true)
  })
})
