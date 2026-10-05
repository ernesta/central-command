import { sheetDate } from './hours-sheet'

/**
 * Reading the user's Google Sheet "Time Tracking" for Work: one running log, newest first, one row per piece of work
 * (Date, Hours as a decimal, Accounted, Client, Team, Activity). Columns G onwards are scratch notes and a week panel
 * and are never read as data. Nothing is guessed: a row that does not fit is a problem, not a skipped row.
 */

export interface WorkRow {
  /** 1-based sheet row, so a report can say where to look. */
  row: number
  date: string
  /** Hours as typed. */
  hours: number
  /** Whole minutes, as typed (a typo is corrected later, by the plan, and reported). */
  minutes: number
  accounted: boolean
  /** The sheet's Team: `Impact` or `Teaching` (the app's client is `Teaching & Learning`). */
  team: 'Impact' | 'Teaching'
  activity: string
}

export interface WorkSheet {
  rows: WorkRow[]
  /** Text beside a data row in columns G onwards, read by nothing. */
  scratch: { row: number; text: string }[]
  problems: string[]
}

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase()
const cell = (row: string[], col: number): string => (row[col] ?? '').trim()

export function parseWorkSheet(rows: string[][]): WorkSheet {
  const out: WorkSheet = { rows: [], scratch: [], problems: [] }
  const head = rows[0] ?? []
  const expected = ['date', 'hours', 'accounted', 'client', 'team', 'activity']
  for (let c = 0; c < expected.length; c++)
    if (norm(head[c]) !== expected[c]) {
      out.problems.push(
        `This is not the Time Tracking sheet: ${String.fromCharCode(65 + c)}1 should be "${expected[c]}" but is "${cell(head, c)}".`
      )
      return out
    }
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? []
    const n = i + 1
    if (r.slice(0, 6).every((c) => (c ?? '').trim() === '')) continue
    const date = sheetDate(cell(r, 0))
    const hours = cell(r, 1) === '' ? null : Number(cell(r, 1))
    const accounted = norm(r[2])
    const team = norm(r[4])
    const activity = cell(r, 5).replace(/\s+/g, ' ')
    const bad: string[] = []
    if (date === null) bad.push(`the date "${cell(r, 0)}" is not a date`)
    if (hours === null || !Number.isFinite(hours) || hours <= 0)
      bad.push(`the hours "${cell(r, 1)}" are not a positive number`)
    if (accounted !== 'yes' && accounted !== 'no')
      bad.push(`Accounted "${cell(r, 2)}" is not Yes or No`)
    if (norm(r[3]) !== 'luminos') bad.push(`the client "${cell(r, 3)}" is not Luminos`)
    if (team !== 'impact' && team !== 'teaching')
      bad.push(`the team "${cell(r, 4)}" is not Impact or Teaching`)
    if (activity === '') bad.push('the activity is empty')
    if (bad.length > 0 || date === null || hours === null) {
      out.problems.push(`Row ${n}: ${bad.join('; ')}.`)
      continue
    }
    out.rows.push({
      row: n,
      date,
      hours,
      minutes: Math.round(hours * 60),
      accounted: accounted === 'yes',
      team: team === 'impact' ? 'Impact' : 'Teaching',
      activity
    })
    const extra = r
      .slice(6)
      .map((c) => (c ?? '').trim())
      .filter((c) => c !== '')
    if (extra.length > 0) out.scratch.push({ row: n, text: extra.join(' | ') })
  }
  if (out.rows.length === 0) out.problems.push('The sheet has no dated rows.')
  return out
}
