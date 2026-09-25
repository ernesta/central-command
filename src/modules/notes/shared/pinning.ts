import type { NoteIndexRow } from './types'

/** At most this many notes are pinned; they are the cards at the top of the landing page. */
export const MAX_PINNED = 4

type Pinnable = Pick<NoteIndexRow, 'id' | 'pinned'>

/** True when `id` may be pinned: it already is, or fewer than four other notes are. */
export function canPin(rows: readonly Pinnable[], id: string): boolean {
  const others = rows.filter((r) => r.pinned && r.id !== id).length
  return others < MAX_PINNED
}

/**
 * The notes shown as pinned: the four most recently edited of those marked pinned. More than four can only
 * happen when a file is edited by hand; the app never pins a fifth.
 */
export function pinnedNotes(rows: readonly NoteIndexRow[]): NoteIndexRow[] {
  return rows
    .filter((r) => r.pinned)
    .sort((a, b) => b.edited - a.edited || a.id.localeCompare(b.id))
    .slice(0, MAX_PINNED)
}
