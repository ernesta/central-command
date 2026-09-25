import { modulePath } from '@modules/types'

export const trainingBase = modulePath({ workspace: 'research', id: 'training' })

/** The route of one entry. Ids contain spaces, so they are encoded. */
export function entryRoute(id: string): string {
  return `${trainingBase}/t/${encodeURIComponent(id)}`
}

export { todayIso } from '@shared/time'
