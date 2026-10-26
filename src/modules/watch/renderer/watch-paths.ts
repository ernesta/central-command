import type { ShownKind } from '../shared/types'

export const watchBase = '/research/watch'

/** The list of one kind's items (See all trainings, See all conferences). */
export const watchListRoute = (kind: ShownKind): string =>
  `${watchBase}/${kind === 'training' ? 'trainings' : 'conferences'}`

export { todayIso } from '@shared/time'
