import { modulePath } from '@modules/types'

export const meetingsBase = modulePath({ workspace: 'research', id: 'meetings' })

/** The route of one meeting. Ids contain spaces, so they are encoded. */
export function meetingRoute(id: string): string {
  return `${meetingsBase}/${encodeURIComponent(id)}`
}

/** Today's date in local time as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
