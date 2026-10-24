const DAY_MS = 86_400_000
const dayIndex = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS)

/** Calendar days from a due date to today when the date has passed, else 0. One rule for the chip and for Home's summary. */
export function daysLate(due: string | null, today: string): number {
  return due === null ? 0 : Math.max(0, dayIndex(today) - dayIndex(due))
}

/** "1 day late", "103 days late". */
export function lateLabel(days: number): string {
  return days === 1 ? '1 day late' : `${days} days late`
}
