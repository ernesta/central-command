import { parseHours } from '@shared/tracking/format'
import { QUARTER } from '@shared/tracking/rounding'

/** How many days back (today included) the quick-start names reach. */
export const RECENT_DAYS = 7

/** Time typed for a task: "1:15", "2" or "1.25", in whole quarter hours. Null for anything else. */
export function parseQuarterHours(text: string): number | null {
  const minutes = parseHours(text)
  return minutes !== null && minutes % QUARTER === 0 ? minutes : null
}
