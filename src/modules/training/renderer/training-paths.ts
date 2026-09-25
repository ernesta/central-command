import { modulePath } from '@modules/types'

export const trainingBase = modulePath({ workspace: 'research', id: 'training' })

/** The list of all entries. */
export const trainingListRoute = `${trainingBase}/all`

/** The list filtered to one series (and academic year), as opened from a series card on the landing page. */
export function seriesRoute(series: string, year?: number): string {
  const yearPart = year === undefined ? '' : `&year=${year}`
  return `${trainingListRoute}?series=${encodeURIComponent(series)}${yearPart}`
}

/** The route of one entry. Ids contain spaces, so they are encoded. */
export function entryRoute(id: string): string {
  return `${trainingBase}/t/${encodeURIComponent(id)}`
}

export { todayIso } from '@shared/time'
