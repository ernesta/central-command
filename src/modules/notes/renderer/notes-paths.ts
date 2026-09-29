import { useLocation } from 'react-router'
import { modulePath } from '@modules/types'
import { NOTE_WORKSPACES, type NoteWorkspace } from '../shared/types'

export function notesBase(workspace: NoteWorkspace): string {
  return modulePath({ workspace, id: 'notes' })
}

/** The list of all notes. */
export function notesListRoute(workspace: NoteWorkspace): string {
  return `${notesBase(workspace)}/all`
}

/** The list filtered to a group (or its subgroup), as opened from a group card on the landing page. */
export function groupRoute(workspace: NoteWorkspace, group: string, subgroup = ''): string {
  const sub = subgroup ? `&subgroup=${encodeURIComponent(subgroup)}` : ''
  return `${notesListRoute(workspace)}?group=${encodeURIComponent(group)}${sub}`
}

/** The list of notes that have no group. */
export function ungroupedRoute(workspace: NoteWorkspace): string {
  return `${notesListRoute(workspace)}?ungrouped=1`
}

/** The route of one note. Ids contain spaces, so they are encoded. */
export function noteRoute(workspace: NoteWorkspace, id: string): string {
  return `${notesBase(workspace)}/n/${encodeURIComponent(id)}`
}

/** Which workspace's notes the current page belongs to, read from the URL (`/research/…` or `/work/…`). */
export function useNotesWorkspace(): NoteWorkspace {
  const { pathname } = useLocation()
  const segment = pathname.split('/')[1]
  return (NOTE_WORKSPACES as readonly string[]).includes(segment)
    ? (segment as NoteWorkspace)
    : 'research'
}
