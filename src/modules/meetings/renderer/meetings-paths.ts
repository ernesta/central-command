import { modulePath } from '@modules/types'

export const meetingsBase = modulePath({ workspace: 'research', id: 'meetings' })

/** The list of all meetings (and the supervision log). */
export const meetingsListRoute = `${meetingsBase}/all`

/** The people list. */
export const peopleRoute = `${meetingsBase}/people`

/** The list filtered to one series, as opened from a series card on the landing page. */
export function seriesRoute(series: string, year?: number): string {
  const yearPart = year === undefined ? '' : `&year=${year}`
  return `${meetingsListRoute}?series=${encodeURIComponent(series)}${yearPart}`
}

/** The route of one meeting. Ids contain spaces, so they are encoded. */
export function meetingRoute(id: string): string {
  return `${meetingsBase}/m/${encodeURIComponent(id)}`
}

export { todayIso } from '@shared/time'
