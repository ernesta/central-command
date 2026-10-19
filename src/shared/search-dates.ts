/** A stretch of days, both ends included, as YYYY-MM-DD. */
export interface DayRange {
  from: string
  to: string
}

const pad = (n: number): string => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date)
  const next = new Date(y, m - 1, d + days)
  return iso(next.getFullYear(), next.getMonth() + 1, next.getDate())
}

function daysIn(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function monthRange(year: number, month: number): DayRange {
  return { from: iso(year, month, 1), to: iso(year, month, daysIn(year, month)) }
}

function yearRange(year: number): DayRange {
  return { from: iso(year, 1, 1), to: iso(year, 12, 31) }
}

/** The Monday of the week `date` is in. */
export function weekStart(date: string): string {
  const [y, m, d] = parts(date)
  return addDays(date, -((new Date(y, m - 1, d).getDay() + 6) % 7))
}

/** `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, `today` or `yesterday` (folded) as the days it covers; null for anything else. */
export function parseDateRange(value: string, today: string): DayRange | null {
  if (value === 'today') return { from: today, to: today }
  if (value === 'yesterday') {
    const day = addDays(today, -1)
    return { from: day, to: day }
  }
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null
    const day = iso(y, mo, d)
    return { from: day, to: day }
  }
  m = /^(\d{4})-(\d{2})$/.exec(value)
  if (m) {
    const [y, mo] = [Number(m[1]), Number(m[2])]
    return mo >= 1 && mo <= 12 ? monthRange(y, mo) : null
  }
  m = /^(\d{4})$/.exec(value)
  return m ? yearRange(Number(m[1])) : null
}

/** What `during:` takes: a month, a year, today, yesterday, or this or last week (Monday to Sunday), month or year. */
export function parsePeriod(value: string, today: string): DayRange | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m] = parts(today)
  switch (value) {
    case 'this week': {
      const from = weekStart(today)
      return { from, to: addDays(from, 6) }
    }
    case 'last week': {
      const from = addDays(weekStart(today), -7)
      return { from, to: addDays(from, 6) }
    }
    case 'this month':
      return monthRange(y, m)
    case 'last month':
      return m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1)
    case 'this year':
      return yearRange(y)
    case 'last year':
      return yearRange(y - 1)
    default:
      return parseDateRange(value, today)
  }
}

/**
 * Whether an item dated `item` (the days it covers; a reading covers its year) passes a date modifier whose value covers `range`:
 * `before` is wholly before it, `after` wholly after, `on` and `during` inside it. An item with no date passes none.
 */
export function dateMatches(
  name: 'before' | 'after' | 'on' | 'during',
  range: DayRange,
  item: DayRange | null
): boolean {
  if (item === null) return false
  if (name === 'before') return item.to < range.from
  if (name === 'after') return item.from > range.to
  return item.from >= range.from && item.to <= range.to
}

/** A day (or '' for none) as the range an item covers. */
export function dayItem(date: string | null): DayRange | null {
  return date ? { from: date, to: date } : null
}

/** A year (or null) as the range a reading covers. */
export function yearItem(year: number | null): DayRange | null {
  return year === null ? null : yearRange(year)
}
