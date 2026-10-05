import { addDays } from '../year'

/** The weekday a workspace's weeks (and so its years) begin on, Monday = 1. Work's contract runs Friday to Thursday. */
const WEEK_START_DAY: Record<string, number> = { work: 5 }

export function weekStartDay(workspace: string): number {
  return WEEK_START_DAY[workspace] ?? 1
}

/**
 * A workspace's year starts: the app's year starts (Mondays, in Settings) moved on to the day its weeks begin, so a
 * Work year starts on the Friday after the shared Monday and still lasts 52 whole weeks.
 */
export function trackingStarts(workspace: string, starts: readonly string[]): string[] {
  const shift = weekStartDay(workspace) - 1
  return starts.map((s) => (shift === 0 ? s : addDays(s, shift)))
}
