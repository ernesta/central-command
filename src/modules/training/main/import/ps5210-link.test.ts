import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../../main/db/migrate'
import { tasksMigrations } from '../../../tasks/main/migrations'
import { withDerived } from '../../../../shared/tracking/derived'
import { parseYear } from '../../../../shared/tracking/parse'
import { PS5210_NOTES, PS5210_SERIES, linkPs5210, planDaySplit } from './ps5210-link'

const note = (date: string, start: string, end: string, title: string): string =>
  `---\ndate: ${date}\nstart: '${start}'\nend: '${end}'\ntitle: ${title}\nseries: ${PS5210_SERIES}\n---\n\n## Summary\n## Notes\n- body\n`
const NOTES = [
  note('2026-09-30', '09:00', '11:00', 'Introduction'),
  note('2026-10-07', '09:00', '11:00', 'fNIRS'),
  note('2026-10-07', '13:00', '14:00', 'fNIRS Practical Lab')
]
const YEAR = {
  version: 1,
  start: '2026-09-21',
  plan: { hoursPerWeek: 2250, workDays: [1, 2, 3, 4, 5], allowanceDays: 40 },
  carryIn: 0,
  sessions: [],
  adjusts: [],
  days: { '2026-09-29': { minutes: 450 }, '2026-09-30': { minutes: 255 } },
  timeOff: [],
  weekDays: {}
}

let root: string
let db: Database.Database
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ps5210-'))
  mkdirSync(join(root, 'notes', 'training', 'research'), { recursive: true })
  mkdirSync(join(root, 'time', 'research'), { recursive: true })
  PS5210_NOTES.forEach((n, i) =>
    writeFileSync(join(root, 'notes', 'training', 'research', n.file), NOTES[i])
  )
  writeFileSync(
    join(root, 'time', 'research', '2026-27.json'),
    JSON.stringify(YEAR, null, 2) + '\n'
  )
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, tasksMigrations)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('planDaySplit', () => {
  it('lowers the day by the lecture and adds an earlier entry for it, the day sum unchanged', () => {
    const plan = planDaySplit(JSON.stringify(YEAR), 'abc12345', 'deadbeef')
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const next = JSON.parse(plan.next)
    expect(next.days['2026-09-30'].minutes).toBe(135)
    expect(next.days['2026-09-29'].minutes).toBe(450)
    expect(next.adjusts).toEqual([
      {
        id: 'deadbeef',
        date: '2026-09-30',
        label: 'Introduction',
        minutes: 120,
        task: 'cc://task/abc12345',
        earlier: true
      }
    ])
  })

  it('refuses a day that holds less than the lecture, a missing day and a lecture already linked', () => {
    const small = { ...YEAR, days: { '2026-09-30': { minutes: 60 } } }
    expect(planDaySplit(JSON.stringify(small), 'abc12345', 'x').ok).toBe(false)
    expect(planDaySplit(JSON.stringify({ ...YEAR, days: {} }), 'abc12345', 'x').ok).toBe(false)
    const done = planDaySplit(JSON.stringify(YEAR), 'abc12345', 'x')
    if (done.ok) expect(planDaySplit(done.next, 'abc12345', 'y').ok).toBe(false)
  })
})

describe('linkPs5210', () => {
  it('a dry run writes nothing', () => {
    const report = linkPs5210(root, db, false, 't')
    expect(report.ok).toBe(true)
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 0 })
    expect(readFileSync(join(root, 'time', 'research', '2026-27.json'), 'utf8')).toBe(
      JSON.stringify(YEAR, null, 2) + '\n'
    )
  })

  it('makes the series and three subtasks, links the notes and counts the hours once', () => {
    const report = linkPs5210(root, db, true, 't')
    expect(report.ok).toBe(true)
    const series = db.prepare('SELECT uid, list, title FROM tasks WHERE parent_uid IS NULL').all()
    expect(series).toHaveLength(1)
    const subs = db.prepare('SELECT uid, title FROM tasks WHERE parent_uid IS NOT NULL').all() as {
      uid: string
      title: string
    }[]
    expect(subs.map((s) => s.title).sort()).toEqual([
      'Introduction',
      'fNIRS',
      'fNIRS Practical Lab'
    ])
    PS5210_NOTES.forEach((n) => {
      const text = readFileSync(join(root, 'notes', 'training', 'research', n.file), 'utf8')
      const uid = subs.find((s) => s.title === n.title)!.uid
      expect(text).toContain(`task: ${uid}`)
    })
    // Hours: the 30 Sep total is unchanged and only the two 7 Oct sessions add time.
    const year = parseYear(
      JSON.parse(readFileSync(join(root, 'time', 'research', '2026-27.json'), 'utf8'))
    )!
    const entries = subs.map((s, i) => ({
      kind: 'training' as const,
      id: PS5210_NOTES[i].file,
      date: i === 0 ? '2026-09-30' : '2026-10-07',
      start: ['09:00', '09:00', '13:00'][i],
      end: ['11:00', '11:00', '14:00'][i],
      task: `cc://task/${subs.find((x) => x.title === PS5210_NOTES[i].title)!.uid}`,
      label: s.title
    }))
    const shown = withDerived(year, entries)
    expect(shown.sessions.filter((s) => s.derived).map((s) => s.date)).toEqual([
      '2026-10-07',
      '2026-10-07'
    ])
  })

  it('stops before writing when a note already holds another task', () => {
    const path = join(root, 'notes', 'training', 'research', PS5210_NOTES[1].file)
    writeFileSync(path, NOTES[1].replace('series:', 'task: other999\nseries:'))
    const report = linkPs5210(root, db, true, 't')
    expect(report.ok).toBe(false)
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 0 })
  })

  it('a second run changes nothing', () => {
    linkPs5210(root, db, true, 't')
    const again = linkPs5210(root, db, true, 't2')
    expect(again.ok).toBe(false)
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 4 })
  })
})
