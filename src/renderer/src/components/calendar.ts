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

const POPOVER_WIDTH = 248
const POPOVER_HEIGHT = 300
const EDGE = 8

/** Where the fixed calendar goes: under the button, above it when there is no room below, and inside the window sideways. */
export function popoverPlace(
  rect: { top: number; bottom: number; left: number },
  width: number,
  height: number
): { top: number; left: number } {
  const below = rect.bottom + 4
  const above = rect.top - 4 - POPOVER_HEIGHT
  const top = below + POPOVER_HEIGHT > height - EDGE && above >= EDGE ? above : below
  return { top, left: Math.max(EDGE, Math.min(rect.left, width - POPOVER_WIDTH - EDGE)) }
}
