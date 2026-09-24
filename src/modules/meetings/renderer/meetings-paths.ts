import { modulePath } from '@modules/types'

export const meetingsBase = modulePath({ workspace: 'research', id: 'meetings' })

/** The list of all meetings (and the supervision log). */
export const meetingsListRoute = `${meetingsBase}/all`

/** The list filtered to one series, as opened from a series card on the landing page. */
export function seriesRoute(series: string): string {
  return `${meetingsListRoute}?series=${encodeURIComponent(series)}`
}

/** The route of one meeting. Ids contain spaces, so they are encoded. */
export function meetingRoute(id: string): string {
  return `${meetingsBase}/m/${encodeURIComponent(id)}`
}

/** Today's date in local time as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
