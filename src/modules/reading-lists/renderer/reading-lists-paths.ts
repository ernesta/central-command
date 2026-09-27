import { modulePath } from '@modules/types'

export const readingListsBase = modulePath({ workspace: 'research', id: 'reading-lists' })

/** The list of all reading lists. */
export const readingListsListRoute = `${readingListsBase}/all`

/** The route of one list. Ids contain spaces, so they are encoded. */
export function readingListRoute(id: string): string {
  return `${readingListsBase}/l/${encodeURIComponent(id)}`
}
