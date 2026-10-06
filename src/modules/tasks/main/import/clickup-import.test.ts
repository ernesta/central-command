import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../../../../main/db/migrate'
import { tasksMigrations } from '../migrations'
import { listTasks } from '../repository'
import { StoreNotEmptyError, applyClickupPlan } from './clickup-apply'
import {
  DifferingDuplicateError,
  checkPlan,
  dueDateOf,
  planImport,
  readClickup,
  sourceTotals
} from './clickup-import'
import { tasksMigrationsFromDir } from './migration-files'

const HEADER = [
  'Task ID',
  'Task Name',
  'Task Content',
  'Status',
  'Date Created',
  'Due Date Text',
  'Parent ID',
  'Subtasks IDs',
  'Attachments',
  'Tags',
  'Priority',
  'List Name',
  'Folder Name/Path',
  'Space Name',
  'Time Spent',
  'Checklists',
  'Comments'
]

function rec(over: Record<string, string>): string[] {
  const base: Record<string, string> = {
    'Task ID': 'x',
    'Task Name': 'Task',
    'Task Content': 'null',
    Status: 'to do',
    'Date Created': '1758533961316',
    'Due Date Text': '',
    'Parent ID': 'null',
    'Subtasks IDs': '',
    Attachments: '[]',
    Tags: '[]',
    Priority: '3',
    'List Name': 'Reading',
    'Folder Name/Path': '',
    'Space Name': 'PhD Studies',
    'Time Spent': '',
    Checklists: '{}',
    Comments: '[]'
  }
  return HEADER.map((h) => over[h] ?? base[h])
}
const csv = (...rows: Record<string, string>[]): string[][] => [HEADER, ...rows.map(rec)]
const DUE = (m: number, d: number): string => `${m}/${d}/2026, 4:00:00 AM GMT+1`

describe('dueDateOf', () => {
  it('takes the calendar date as written, whatever the time zone', () => {
    expect(dueDateOf('3/13/2026, 4:00:00 AM GMT')).toBe('2026-03-13')
    expect(dueDateOf('10/2/2026, 12:00:00 AM GMT+1')).toBe('2026-10-02')
  })
  it('is null when there is none, and refuses nonsense', () => {
    expect(dueDateOf('')).toBeNull()
    expect(dueDateOf('null')).toBeNull()
    expect(() => dueDateOf('soon')).toThrow()
    expect(() => dueDateOf('13/40/2026, 4:00:00 AM GMT')).toThrow()
  })
})

describe('readClickup', () => {
  it('de-duplicates identical rows by id and reports before and after', () => {
    const data = readClickup(csv({ 'Task ID': 'a' }, { 'Task ID': 'a' }, { 'Task ID': 'b' }))
    expect(data).toMatchObject({ rowsBefore: 3, rowsAfter: 2, repeatedIds: 1 })
    expect(data.rows.map((r) => r.id)).toEqual(['a', 'b'])
  })
  it('stops loudly when two rows with one id differ in any cell', () => {
    expect(() =>
      readClickup(csv({ 'Task ID': 'a' }, { 'Task ID': 'a', 'Time Spent': ' "60000"' }))
    ).toThrow(DifferingDuplicateError)
    expect(() => readClickup(csv({ 'Task ID': 'a' }, { 'Task ID': 'a', Tags: '[x]' }))).toThrow(
      /Tags/
    )
  })
  it('refuses a file without a needed column or with a ragged row', () => {
    expect(() => readClickup([HEADER.slice(1), ['x']])).toThrow('Task ID')
    expect(() => readClickup([HEADER, ['only one']])).toThrow('cells')
  })
  it('reads time, tags, folders, attachments and literal \\n in the text', () => {
    const { rows } = readClickup(
      csv({
        'Time Spent': ' "900000"',
        Tags: '[ghana,study 1]',
        'Folder Name/Path': '["Study 2: USAID Analysis"]',
        Attachments: '[{"title":"a.png","url":"https://x/a.png"}]',
        'Task Content': 'one\\ntwo\\n'
      })
    )
    expect(rows[0]).toMatchObject({
      timeMs: 900000,
      tags: ['ghana', 'study 1'],
      folders: ['Study 2: USAID Analysis'],
      content: 'one\ntwo',
      attachments: [{ title: 'a.png', url: 'https://x/a.png' }]
    })
  })
})

describe('planImport', () => {
  const plan = (rows: Record<string, string>[]): ReturnType<typeof planImport> =>
    planImport(readClickup(csv(...rows)))
  const find = (p: ReturnType<typeof planImport>, id: string): (typeof p.tasks)[number] =>
    p.tasks.find((t) => t.sourceId === id) as (typeof p.tasks)[number]

  it('maps space, status, priority, list and sublist', () => {
    const p = plan([
      {
        'Task ID': 'a',
        Status: 'in progress',
        Priority: '2',
        'List Name': 'Data Cleaning',
        'Folder Name/Path': '["Study 2"]'
      },
      { 'Task ID': 'b', Status: 'complete', Priority: 'null', 'Space Name': 'Consulting' },
      { 'Task ID': 'c', Priority: '1' },
      { 'Task ID': 'd', Priority: '4' }
    ])
    expect(find(p, 'a').input).toMatchObject({
      workspace: 'research',
      status: 'doing',
      priority: 'high',
      list: 'Study 2',
      sublist: 'Data Cleaning'
    })
    expect(find(p, 'b').input).toMatchObject({
      workspace: 'work',
      status: 'done',
      priority: 'normal',
      list: 'Reading',
      sublist: '',
      completedAt: null
    })
    expect(find(p, 'c').input.priority).toBe('high')
    expect(find(p, 'd').input.priority).toBe('low')
  })

  it('keeps every subtask date, also one that repeats the parent’s', () => {
    const p = plan([
      { 'Task ID': 'p', 'Due Date Text': DUE(10, 9) },
      { 'Task ID': 's1', 'Parent ID': 'p', 'Due Date Text': DUE(10, 9) },
      { 'Task ID': 's2', 'Parent ID': 'p', 'Due Date Text': DUE(10, 7) }
    ])
    expect(find(p, 's1').input.due).toBe('2026-10-09')
    expect(find(p, 's2').input.due).toBe('2026-10-07')
    expect(p.report.subtaskDatesKept).toBe(2)
  })

  it('gives a subtask no list and no priority of its own', () => {
    const p = plan([
      { 'Task ID': 'p', Priority: '1' },
      { 'Task ID': 's', 'Parent ID': 'p', Priority: '1', 'List Name': 'Elsewhere' }
    ])
    expect(find(p, 's').input).toMatchObject({ list: '', priority: 'normal' })
    expect(find(p, 's').parentSourceId).toBe('p')
  })

  it('a parent with no date takes the earliest date of an open subtask', () => {
    const p = plan([
      { 'Task ID': 'p' },
      { 'Task ID': 's1', 'Parent ID': 'p', 'Due Date Text': DUE(10, 20) },
      { 'Task ID': 's2', 'Parent ID': 'p', 'Due Date Text': DUE(10, 7) },
      { 'Task ID': 's3', 'Parent ID': 'p', 'Due Date Text': DUE(10, 1), Status: 'complete' }
    ])
    expect(find(p, 'p').input.due).toBe('2026-10-07')
    expect(p.report.parentsTookDate).toEqual([{ title: 'Task', due: '2026-10-07' }])
  })

  it('moves a sub-subtask up to the top-level task with its former parent’s title in front', () => {
    const p = plan([
      { 'Task ID': 't', 'Task Name': 'Course' },
      { 'Task ID': 's', 'Task Name': 'Lecture', 'Parent ID': 't' },
      { 'Task ID': 'g', 'Task Name': 'Read it', 'Parent ID': 's' }
    ])
    expect(find(p, 'g')).toMatchObject({ parentSourceId: 't' })
    expect(find(p, 'g').input.title).toBe('Lecture › Read it')
    expect(p.report.flattened).toHaveLength(1)
    expect(p.report).toMatchObject({ topLevel: 1, subtasks: 2 })
  })

  it('orders subtasks as the parent lists them, moved-up ones last', () => {
    const p = plan([
      { 'Task ID': 't', 'Subtasks IDs': 'b,a' },
      { 'Task ID': 'a', 'Parent ID': 't' },
      { 'Task ID': 'g', 'Parent ID': 'a' },
      { 'Task ID': 'b', 'Parent ID': 't' }
    ])
    const pos = (id: string): number => find(p, id).input.position as number
    expect(pos('b')).toBeLessThan(pos('a'))
    expect(pos('a')).toBeLessThan(pos('g'))
  })

  it('carries time in minutes on the task that has it, and tags, created time and attachments', () => {
    const p = plan([
      {
        'Task ID': 'a',
        'Time Spent': ' "5400000"',
        Tags: '[billable]',
        Attachments: '[{"title":"a.png","url":"https://x/a.png"}]',
        'Task Content': 'Notes'
      }
    ])
    const input = find(p, 'a').input
    expect(input).toMatchObject({
      earlierMinutes: 90,
      tags: ['billable'],
      sourceId: 'a',
      createdAt: '2025-09-22T09:39:21.316Z'
    })
    expect(input.description).toBe(
      'Notes\n\nAttachments from ClickUp:\n\n- [a.png](https://x/a.png)'
    )
    expect(p.report.attachments).toHaveLength(1)
  })

  it('leaves out a task that fails a check, with its subtasks, and says so', () => {
    const p = plan([
      { 'Task ID': 'a', 'Space Name': 'Mystery' },
      { 'Task ID': 'b', 'Parent ID': 'a' },
      { 'Task ID': 'c', 'Parent ID': 'missing' },
      { 'Task ID': 'd' }
    ])
    expect(p.tasks.map((t) => t.sourceId)).toEqual(['d'])
    expect(p.report.leftOut.map((l) => l.sourceId).sort()).toEqual(['a', 'b', 'c'])
    expect(checkPlan(p, sourceTotals(readClickup(csv({ 'Task ID': 'd' })).rows))).not.toEqual([])
  })

  it('passes its own checks on a clean file and fails them when the plan loses time', () => {
    const data = readClickup(csv({ 'Task ID': 'a', 'Time Spent': ' "60000"' }, { 'Task ID': 'b' }))
    const p = planImport(data)
    expect(checkPlan(p, sourceTotals(data.rows))).toEqual([])
    p.tasks[0].input.earlierMinutes = 0
    p.report.totalMinutes = 0
    expect(checkPlan(p, sourceTotals(data.rows)).join()).toContain('time')
  })

  it('proposes a rule for a repeating title with exactly one open instance', () => {
    const rows = [1, 2, 3, 4, 5].map((n) => ({
      'Task ID': `w${n}`,
      'Task Name': 'Weekly thing',
      Status: n === 5 ? 'to do' : 'complete',
      'Due Date Text': ['9/7', '9/14', '9/21', '9/28', '10/5'][n - 1].replace(
        /$/,
        '/2026, 4:00:00 AM GMT+1'
      )
    }))
    const { series } = plan(rows).report
    expect(series).toEqual([
      expect.objectContaining({ title: 'Weekly thing', instances: 5, rule: 'every week' })
    ])
  })
})

describe('applyClickupPlan', () => {
  const build = (): Database.Database => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db, tasksMigrations)
    return db
  }
  const data = readClickup(
    csv(
      { 'Task ID': 'p', 'Task Name': 'Parent', Status: 'in progress', 'Time Spent': ' "120000"' },
      { 'Task ID': 's', 'Task Name': 'Kid', 'Parent ID': 'p', Status: 'complete' },
      { 'Task ID': 'g', 'Task Name': 'Grandkid', 'Parent ID': 's' },
      { 'Task ID': 'q', 'Task Name': 'Other', Status: 'complete', 'Space Name': 'Consulting' }
    )
  )

  it('writes the plan and reads it back', () => {
    const db = build()
    const p = planImport(data)
    expect(applyClickupPlan(db, p).created).toBe(4)
    const research = listTasks(db, 'research')
    expect(research.map((t) => t.title).sort()).toEqual(['Kid', 'Kid › Grandkid', 'Parent'])
    expect(research.find((t) => t.title === 'Parent')).toMatchObject({
      status: 'doing',
      earlierMinutes: 2,
      sourceId: 'p'
    })
    expect(research.filter((t) => t.parentUid)).toHaveLength(2)
    expect(research.find((t) => t.title === 'Kid')).toMatchObject({
      completedAt: null,
      status: 'done'
    })
  })

  it('never adds to a store that already holds tasks, and writes nothing', () => {
    const db = build()
    applyClickupPlan(db, planImport(data))
    expect(() => applyClickupPlan(db, planImport(data))).toThrow(StoreNotEmptyError)
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 4 })
  })

  it('rolls everything back when the rows do not read back as planned', () => {
    const db = build()
    const p = planImport(data)
    p.report.totalMinutes += 1
    expect(() => applyClickupPlan(db, p)).toThrow(/read back/)
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 0 })
  })
})

describe('migration files', () => {
  it('match the migrations the app runs, so the importer and the app agree on the schema', () => {
    const fromDir = tasksMigrationsFromDir('src/modules/tasks/main/migrations')
    expect(fromDir).toEqual(tasksMigrations)
  })
})
