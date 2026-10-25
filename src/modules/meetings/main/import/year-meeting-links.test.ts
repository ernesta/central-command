import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../../main/db/migrate'
import { tasksMigrations } from '../../../tasks/main/migrations'
import { listTasks } from '../../../tasks/main/repository'
import { candidates, linkYearMeetings, planDaySplits } from './year-meeting-links'

const note = (date: string, series: string, extra = ''): string =>
  `---\nseries: ${series}\ndate: ${date}\nstart: '14:30'\nend: '15:00'\n${extra}---\n\n## Notes\n- body\n`
const YEAR = {
  version: 1,
  start: '2026-09-21',
  plan: { hoursPerWeek: 2250, workDays: [1, 2, 3, 4, 5], allowanceDays: 40 },
  carryIn: 0,
  sessions: [],
  adjusts: [],
  days: { '2026-09-23': { minutes: 255 }, '2026-09-24': { minutes: 465 } },
  timeOff: [],
  weekDays: {}
}
const yearText = (): string => JSON.stringify(YEAR, null, 2) + '\n'

let root: string
let db: Database.Database
const dir = (): string => join(root, 'notes', 'meetings', 'research')
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'year-meetings-'))
  mkdirSync(dir(), { recursive: true })
  mkdirSync(join(root, 'time', 'research'), { recursive: true })
  writeFileSync(join(dir(), '2026-09-24 Supervision.md'), note('2026-09-24', 'Supervision'))
  writeFileSync(join(dir(), '2026-10-12 Supervision.md'), note('2026-10-12', 'Supervision'))
  writeFileSync(join(dir(), '2026-07-29 Supervision.md'), note('2026-07-29', 'Supervision'))
  writeFileSync(
    join(dir(), '2026-10-08 Rastle Lab.md'),
    note('2026-10-08', 'Rastle Lab', 'task: abcd1234\n')
  )
  writeFileSync(join(root, 'time', 'research', '2026-27.json'), yearText())
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, tasksMigrations)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('candidates', () => {
  it('takes this year’s notes with no task, none before the year, none with a task, none in the future', () => {
    const notes = readdirSync(dir()).map((file) => ({
      file,
      text: readFileSync(join(dir(), file), 'utf8')
    }))
    expect(candidates(notes, '2026-10-12').map((c) => c.file)).toEqual([
      '2026-09-24 Supervision.md',
      '2026-10-12 Supervision.md'
    ])
    expect(candidates(notes, '2026-10-01').map((c) => c.file)).toEqual([
      '2026-09-24 Supervision.md'
    ])
  })
})

describe('planDaySplits', () => {
  it('takes the meeting out of its day and nothing else, and says where there is no total', () => {
    const plan = planDaySplits(yearText(), [
      { date: '2026-09-24', minutes: 30 },
      { date: '2026-10-12', minutes: 60 }
    ])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const next = JSON.parse(plan.next)
    expect(next.days['2026-09-24'].minutes).toBe(435)
    expect(next.days['2026-09-23'].minutes).toBe(255)
    expect(plan.lines[1]).toMatch(/no imported total/)
  })
  it('refuses a day with less than the meeting and a file laid out differently', () => {
    expect(planDaySplits(yearText(), [{ date: '2026-09-23', minutes: 300 }]).ok).toBe(false)
    expect(planDaySplits(JSON.stringify(YEAR), [{ date: '2026-09-24', minutes: 30 }]).ok).toBe(
      false
    )
  })
})

describe('linkYearMeetings', () => {
  it('a dry run changes nothing', () => {
    const report = linkYearMeetings(root, db, false, '2026-10-12', 's')
    expect(report.ok).toBe(true)
    expect(report.backup).toBeNull()
    expect(listTasks(db, 'research')).toHaveLength(0)
    expect(readFileSync(join(root, 'time', 'research', '2026-27.json'), 'utf8')).toBe(yearText())
  })

  it('makes one series task and a subtask per meeting, links the notes, lowers the day, backs up first', () => {
    const report = linkYearMeetings(root, db, true, '2026-10-12', 's')
    expect(report.ok).toBe(true)
    const tasks = listTasks(db, 'research')
    const series = tasks.filter((t) => !t.parentUid)
    expect(series.map((t) => [t.title, t.list])).toEqual([['Supervision meetings', 'Meetings']])
    expect(
      tasks
        .filter((t) => t.parentUid)
        .map((t) => t.title)
        .sort()
    ).toEqual(['Supervision meetings · Oct 12, 2026', 'Supervision meetings · Sep 24, 2026'])
    const sub = tasks.find((t) => t.title === 'Supervision meetings · Sep 24, 2026')!
    expect(readFileSync(join(dir(), '2026-09-24 Supervision.md'), 'utf8')).toContain(
      `task: ${sub.uid}`
    )
    expect(readFileSync(join(dir(), '2026-07-29 Supervision.md'), 'utf8')).not.toContain('task:')
    expect(readFileSync(join(dir(), '2026-10-08 Rastle Lab.md'), 'utf8')).toContain(
      'task: abcd1234'
    )
    const year = JSON.parse(readFileSync(join(root, 'time', 'research', '2026-27.json'), 'utf8'))
    expect(year.days['2026-09-24'].minutes).toBe(435)
    expect(report.backup).not.toBeNull()
    expect(readdirSync(join(report.backup!, 'time-research'))).toEqual(['2026-27.json'])
  })

  it('takes up a series task that already exists, and a second run finds nothing', () => {
    db.prepare(
      "INSERT INTO tasks (uid, workspace, title, list, status, position, created_at, updated_at) VALUES ('serie001', 'research', 'Supervision meetings', 'Admin', 'todo', 0, 'x', 'x')"
    ).run()
    expect(linkYearMeetings(root, db, true, '2026-10-12', 's').ok).toBe(true)
    expect(listTasks(db, 'research').filter((t) => !t.parentUid)).toHaveLength(1)
    const again = linkYearMeetings(root, db, true, '2026-10-12', 't')
    expect(again.lines[0]).toMatch(/nothing to link/)
    expect(again.backup).toBeNull()
  })

  it('gives a note that points at its series task a subtask, and leaves the day totals alone', () => {
    db.prepare(
      "INSERT INTO tasks (uid, workspace, title, list, status, position, created_at, updated_at) VALUES ('abcd1234', 'research', 'Rastle Lab meetings', 'Meetings', 'doing', 0, 'x', 'x')"
    ).run()
    expect(linkYearMeetings(root, db, true, '2026-10-12', 's').ok).toBe(true)
    const sub = listTasks(db, 'research').find(
      (t) => t.title === 'Rastle Lab meetings · Oct 8, 2026'
    )!
    expect(sub.parentUid).toBe('abcd1234')
    expect(readFileSync(join(dir(), '2026-10-08 Rastle Lab.md'), 'utf8')).toContain(
      `task: ${sub.uid}`
    )
    const year = JSON.parse(readFileSync(join(root, 'time', 'research', '2026-27.json'), 'utf8'))
    expect(year.days['2026-09-23'].minutes).toBe(255)
  })

  it('stops before writing anything when a day holds less than its meeting', () => {
    writeFileSync(
      join(root, 'time', 'research', '2026-27.json'),
      JSON.stringify({ ...YEAR, days: { '2026-09-24': { minutes: 15 } } }, null, 2) + '\n'
    )
    const report = linkYearMeetings(root, db, true, '2026-10-12', 's')
    expect(report.ok).toBe(false)
    expect(listTasks(db, 'research')).toHaveLength(0)
    expect(readFileSync(join(dir(), '2026-09-24 Supervision.md'), 'utf8')).not.toContain('task:')
  })
})
