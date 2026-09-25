import { fold } from '@shared/text'
import { formatDate } from '@shared/time'
import { isoDate } from './dates'
import {
  ALL_GROUPS,
  groupLabel,
  matchesGroup,
  normaliseFilter,
  reconcileFilter,
  type GroupFilter,
  type GroupSummary
} from './groups'
import type { NoteIndexRow } from './types'

export interface NotesQuery {
  search: string
  group: GroupFilter
}

export const DEFAULT_NOTES_QUERY: NotesQuery = { search: '', group: ALL_GROUPS }

/** Turn whatever was remembered (possibly hand-edited, or from an older version) into a valid query. */
export function normaliseNotesQuery(raw: unknown): NotesQuery {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    search: typeof o.search === 'string' ? o.search : '',
    group: normaliseFilter(o.group)
  }
}

/** The remembered query with a group that no longer exists set back to "all". */
export function reconcileQuery(query: NotesQuery, groups: readonly GroupSummary[]): NotesQuery {
  return { ...query, group: reconcileFilter(query.group, groups) }
}

export const UNTITLED = 'Untitled'

/** What a note is called in lists: its title, else its first line, else "Untitled". */
export function displayTitle(row: Pick<NoteIndexRow, 'title' | 'firstLine'>): string {
  return row.title || row.firstLine || UNTITLED
}

/** Most recently edited first, then by id so the order never jumps. */
export function compareRecent(a: NoteIndexRow, b: NoteIndexRow): number {
  return b.edited - a.edited || a.id.localeCompare(b.id)
}

function haystack(row: NoteIndexRow): string {
  return fold(
    [
      row.title,
      row.firstLine,
      groupLabel(row.group, row.subgroup),
      formatDate(isoDate(row.edited)),
      row.excerpt
    ].join('\n')
  )
}

/** The notes for the list: filtered by group and by every search word, most recently edited first. Pure, like the other queries. */
export function queryNotes(rows: readonly NoteIndexRow[], query: NotesQuery): NoteIndexRow[] {
  const terms = fold(query.search).split(/\s+/).filter(Boolean)
  return rows
    .filter((r) => matchesGroup(r, query.group))
    .filter((r) => {
      if (terms.length === 0) return true
      const text = haystack(r)
      return terms.every((t) => text.includes(t))
    })
    .sort(compareRecent)
}

/** The latest few notes for the landing page. */
export function recentNotes(rows: readonly NoteIndexRow[], limit = 5): NoteIndexRow[] {
  return [...rows].sort(compareRecent).slice(0, limit)
}

/** "12 notes", "1 note". */
export function noteCount(count: number): string {
  return `${count} ${count === 1 ? 'note' : 'notes'}`
}
