import { modulePath } from '@modules/types'

export const notesBase = modulePath({ workspace: 'research', id: 'notes' })

/** The list of all notes. */
export const notesListRoute = `${notesBase}/all`

/** The list filtered to a group (or its subgroup), as opened from a group card on the landing page. */
export function groupRoute(group: string, subgroup = ''): string {
  const sub = subgroup ? `&subgroup=${encodeURIComponent(subgroup)}` : ''
  return `${notesListRoute}?group=${encodeURIComponent(group)}${sub}`
}

/** The list of notes that have no group. */
export const ungroupedRoute = `${notesListRoute}?ungrouped=1`

/** The route of one note. Ids contain spaces, so they are encoded. */
export function noteRoute(id: string): string {
  return `${notesBase}/n/${encodeURIComponent(id)}`
}
