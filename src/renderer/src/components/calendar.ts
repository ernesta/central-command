import { addDays, weekdayOf } from '@shared/year'

/** "2026-10" for a date. */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** The month before or after "2026-10", as "2026-09". */
export function shiftMonth(month: string, by: number): string {
  const index = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + by
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** The days a month's calendar shows: whole weeks from Monday, so it starts and ends with days of the neighbouring months. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`
  let day = addDays(first, 1 - weekdayOf(first))
  const days: string[] = []
  do {
    days.push(day)
    day = addDays(day, 1)
  } while (monthOf(day) === month || days.length % 7 !== 0)
  return days
}
