import { addDays } from '@shared/year'

/** The serial number a spreadsheet stores for a date (days since 30 Dec 1899). */
export function serial(date: string): string {
  return String(Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000))
}

const n = (value: number): string => String(value)

function put(rows: string[][], row: number, col: number, text: string): void {
  rows[row - 1] ??= []
  for (let i = 0; i < col; i++) rows[row - 1][i] ??= ''
  rows[row - 1][col] = text
}

export interface FixtureOptions {
  start: string
  /** Minutes by date for each dated row (a date left out of the map has no row). */
  days: Map<string, number>
  /** Typed planned days by week number; omit for none. */
  weekDays?: Map<number, number>
  /** The weekly column's hours, in minutes, by week number (default: the sum of the days). */
  weekHours?: Map<number, number>
  /** Typed total row, in minutes and days. */
  total?: { minutes: number; days: number }
  /** Extra cells: [row, column index, text]. */
  extra?: [number, number, string][]
  weeks?: number
}

/** A Study Hour Tracker sheet as the reader returns it: newest day first, newest week first. */
export function studyRows(o: FixtureOptions): string[][] {
  const rows: string[][] = []
  ;['Date', 'Hours', '', 'Week', 'Hours', 'Days', 'Plan', 'Average'].forEach((t, c) =>
    put(rows, 1, c, t)
  )
  put(rows, 2, 3, 'Total')
  if (o.total) {
    put(rows, 2, 4, n(o.total.minutes / 60))
    put(rows, 2, 5, n(o.total.days))
  }
  const weeks = o.weeks ?? 52
  const dates = [...o.days.keys()].sort().reverse()
  dates.forEach((d, i) => {
    put(rows, 3 + i, 0, serial(d))
    const minutes = o.days.get(d) as number
    put(rows, 3 + i, 1, minutes === -1 ? '' : n(minutes / 60))
  })
  for (let w = weeks; w >= 1; w--) {
    const r = 3 + (weeks - w)
    put(rows, r, 3, `Week ${w}`)
    const from = addDays(o.start, (w - 1) * 7)
    let sum = 0
    for (let i = 0; i < 7; i++) sum += Math.max(0, o.days.get(addDays(from, i)) ?? 0)
    put(rows, r, 4, n((o.weekHours?.get(w) ?? sum) / 60))
    const days = o.weekDays?.get(w)
    if (days !== undefined) put(rows, r, 5, n(days))
  }
  for (const [r, c, t] of o.extra ?? []) put(rows, r, c, t)
  return rows
}

export interface OffFixture {
  year: string
  rows: { date: string; type: string }[]
  typed?: { public: number; university: number; allowance: number; used: number }
  extra?: [number, number, string][]
}

export function timeOffRows(o: OffFixture): string[][] {
  const rows: string[][] = []
  ;['Year', 'Away Date', 'Done', 'Type'].forEach((t, c) => put(rows, 1, c, t))
  o.rows.forEach((r, i) => {
    put(rows, 2 + i, 0, o.year)
    put(rows, 2 + i, 1, serial(r.date))
    put(rows, 2 + i, 2, 'No')
    put(rows, 2 + i, 3, r.type)
  })
  if (o.typed) {
    put(rows, 1, 5, 'Total')
    put(rows, 1, 6, n(o.typed.used))
    put(rows, 1, 7, n(o.typed.allowance))
    put(rows, 2, 5, 'Public holidays')
    put(rows, 2, 6, n(o.typed.public))
    put(rows, 3, 5, 'University holidays')
    put(rows, 3, 6, n(o.typed.university))
  }
  for (const [r, c, t] of o.extra ?? []) put(rows, r, c, t)
  return rows
}
