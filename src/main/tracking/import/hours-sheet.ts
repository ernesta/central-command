import { addDays, dayNumber, weekStartOf } from '@shared/year'
import type { TimeOffType } from '@shared/tracking/types'

/**
 * Reading the user's two Google Sheets (one workbook per tracking year, tabs "Study Hour Tracker" and "Time Off
 * Tracker") as rows of text. Nothing here is guessed: what does not fit is collected in `problems` (the year
 * cannot be trusted) or in the report lists (told to the user, left out).
 */

export interface DayRow {
  /** 1-based sheet row, so a report can say where to look. */
  row: number
  date: string
  /** Hours as typed. */
  hours: number
  minutes: number
  note?: string
}

export interface WeekRow {
  row: number
  /** 1 to 52, from the label ("Week 5"; the sheet has typos such as "Weel 9"). */
  number: number
  /** The weekly column's own sum, in minutes. */
  sheetMinutes: number | null
  /** Planned days typed by hand. */
  days: number | null
}

export interface StudySheet {
  /** The Monday of the first dated row's week, or null when there are no dated rows. */
  start: string | null
  days: DayRow[]
  weeks: WeekRow[]
  /** The sheet's own "Total" row. */
  typedTotal: { minutes: number | null; days: number | null }
  /** Scratch-area rows (columns J to M), as text. They have no date and are not imported. */
  scratch: string[]
  /** Cells outside every column the importer knows. */
  unread: string[]
  problems: string[]
}

export interface TimeOffRow {
  row: number
  /** The "Year" cell, e.g. 2025-26. */
  yearLabel: string
  date: string
  type: TimeOffType | null
  rawType: string
}

export interface TimeOffSheet {
  rows: TimeOffRow[]
  /** The typed summary: public and university counts, allowance and used. */
  typed: {
    public: number | null
    university: number | null
    allowance: number | null
    used: number | null
  }
  /** Annual leave typed as blocks ("from 1 Apr: 9 days"), which have no exact dates. */
  leaveBlocks: { from: string; days: number }[]
  /** Other text in the summary block. */
  notes: string[]
  problems: string[]
}

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase()
const cell = (row: string[] | undefined, col: number): string => (row?.[col] ?? '').trim()
const COL = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12 }

/** A date serial (days since 30 Dec 1899) or an ISO date as `YYYY-MM-DD`; null for anything else. */
export function sheetDate(text: string): string | null {
  const t = text.trim()
  if (dayNumber(t) !== null) return t
  if (!/^\d{5}(\.0+)?$/.test(t)) return null
  const ms = Date.UTC(1899, 11, 30) + Number(t) * 86_400_000
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

function numberOf(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

const letter = (col: number): string => String.fromCharCode(65 + col)

/** `1030` as 10:30, `1449` as 14:49; anything else as typed. */
function prettyCell(text: string): string {
  const n = numberOf(text)
  if (n !== null && Number.isInteger(n) && n >= 100 && n <= 2359 && n % 100 < 60)
    return `${String(Math.floor(n / 100)).padStart(2, '0')}:${String(n % 100).padStart(2, '0')}`
  return text
}

export function parseStudySheet(rows: string[][]): StudySheet {
  const out: StudySheet = {
    start: null,
    days: [],
    weeks: [],
    typedTotal: { minutes: null, days: null },
    scratch: [],
    unread: [],
    problems: []
  }
  const head = rows[0] ?? []
  const expected: [number, string][] = [
    [COL.A, 'date'],
    [COL.B, 'hours'],
    [COL.D, 'week'],
    [COL.E, 'hours'],
    [COL.F, 'days']
  ]
  for (const [col, name] of expected)
    if (norm(head[col]) !== name) {
      out.problems.push(
        `This is not the Study Hour Tracker: ${letter(col)}1 should be "${name}" but is "${cell(head, col)}".`
      )
      return out
    }

  const total = rows[1] ?? []
  if (norm(total[COL.D]) === 'total') {
    const hours = numberOf(cell(total, COL.E))
    out.typedTotal = {
      minutes: hours === null ? null : Math.round(hours * 60),
      days: numberOf(cell(total, COL.F))
    }
  }

  const known = new Set<number>([COL.A, COL.B, COL.D, COL.E, COL.F, COL.G, COL.H])
  const scratchCols = [COL.J, COL.K, COL.L, COL.M]
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const n = i + 1
    const isTotalRow = i === 1

    // ---- the daily list: columns A and B
    const dateText = cell(row, COL.A)
    const hoursText = cell(row, COL.B)
    let dayRow: DayRow | null = null
    if (dateText !== '' || hoursText !== '') {
      const date = sheetDate(dateText)
      const hours = numberOf(hoursText)
      if (date === null) out.problems.push(`Row ${n}: "${dateText}" is not a date.`)
      else if (hoursText !== '' && (hours === null || hours < 0))
        out.problems.push(`Row ${n}: "${hoursText}" is not a number of hours.`)
      else {
        dayRow = { row: n, date, hours: hours ?? 0, minutes: Math.round((hours ?? 0) * 60) }
        out.days.push(dayRow)
      }
    }

    // ---- the weekly list: columns D to F
    const label = cell(row, COL.D)
    if (!isTotalRow && label !== '') {
      const w = /^wee[kl]\s*(\d+)$/i.exec(label)
      if (!w) out.unread.push(`D${n}: ${label}`)
      else {
        const hours = numberOf(cell(row, COL.E))
        const days = numberOf(cell(row, COL.F))
        out.weeks.push({
          row: n,
          number: Number(w[1]),
          sheetMinutes: hours === null ? null : Math.round(hours * 60),
          days
        })
      }
    }

    // ---- the scratch area: columns J to M (row 1's L is the day's total)
    const [j, k, l, m] = scratchCols.map((c) => cell(row, c))
    const hasTimes = j !== '' || k !== '' || l !== ''
    if (m !== '' && !hasTimes && dayRow) dayRow.note = m
    else if (hasTimes || m !== '') {
      const parts = [
        j !== '' ? `start ${prettyCell(j)}` : '',
        k !== '' ? `end ${prettyCell(k)}` : '',
        l !== '' ? `duration ${l}` : '',
        m
      ].filter(Boolean)
      out.scratch.push(`row ${n}: ${parts.join(', ')}`)
    }

    // ---- anything else
    for (let c = 0; c < row.length; c++) {
      if (known.has(c) || scratchCols.includes(c)) continue
      if (cell(row, c) !== '') out.unread.push(`${letter(c)}${n}: ${cell(row, c)}`)
    }
  }

  if (out.days.length > 0) {
    const first = out.days.map((d) => d.date).sort()[0]
    out.start = weekStartOf(first)
  }
  return out
}

function typeOf(text: string): TimeOffType | null {
  const t = norm(text)
  if (t === 'public holiday') return 'public'
  if (t === 'university holiday') return 'university'
  if (t === 'annual leave' || t === 'leave') return 'leave'
  return null
}

export function parseTimeOffSheet(rows: string[][]): TimeOffSheet {
  const out: TimeOffSheet = {
    rows: [],
    typed: { public: null, university: null, allowance: null, used: null },
    leaveBlocks: [],
    notes: [],
    problems: []
  }
  const head = rows[0] ?? []
  const expected: [number, string][] = [
    [COL.A, 'year'],
    [COL.B, 'away date'],
    [COL.D, 'type']
  ]
  for (const [col, name] of expected)
    if (norm(head[col]) !== name) {
      out.problems.push(
        `This is not the Time Off Tracker: ${letter(col)}1 should be "${name}" but is "${cell(head, col)}".`
      )
      return out
    }
  out.typed.used = numberOf(cell(head, COL.G))
  out.typed.allowance = numberOf(cell(head, COL.H))

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const n = i + 1
    // The summary block in F to I.
    const f = cell(row, COL.F)
    const g = numberOf(cell(row, COL.G))
    if (norm(f) === 'public holidays') out.typed.public = g
    else if (norm(f) === 'university holidays') out.typed.university = g
    else if (sheetDate(f) !== null && dayNumber(f) === null && g !== null)
      out.leaveBlocks.push({ from: sheetDate(f) as string, days: g })
    else if (f !== '') out.notes.push(`F${n}: ${f}`)

    // The list: A to D.
    const dateText = cell(row, COL.B)
    if (dateText === '' && cell(row, COL.A) === '' && cell(row, COL.D) === '') continue
    const date = sheetDate(dateText)
    if (date === null) {
      out.problems.push(`Row ${n}: "${dateText}" is not a date.`)
      continue
    }
    const rawType = cell(row, COL.D)
    out.rows.push({
      row: n,
      yearLabel: cell(row, COL.A),
      date,
      type: typeOf(rawType),
      rawType
    })
  }
  return out
}

/** The dates between the first and last dated row that have no row of their own. */
export function missingDates(days: readonly DayRow[]): string[] {
  if (days.length === 0) return []
  const dates = days.map((d) => d.date).sort()
  const have = new Set(dates)
  const missing: string[] = []
  const last = dates[dates.length - 1]
  for (let d = dates[0]; d <= last; d = addDays(d, 1)) if (!have.has(d)) missing.push(d)
  return missing
}
