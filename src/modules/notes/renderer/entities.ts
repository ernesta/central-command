import { StickyNote } from 'lucide-react'
import { nameFirst } from '@shared/search'
import type { EntityProvider } from '@renderer/entities/registry'
import { groupLabel } from '../shared/groups'
import { DEFAULT_NOTES_QUERY, displayTitle, queryNotes } from '../shared/query'
import { NOTE_WORKSPACES, type NoteIndexRow } from '../shared/types'
import { noteRoute } from './notes-paths'

const WORKSPACE_LABEL = { research: 'Research', work: 'Work' } as const

/** Every note of every workspace, from the index; reused for a couple of seconds (see the meetings' `allMeetings`). */
let cached: { at: number; rows: Promise<NoteIndexRow[]> } | null = null
function allNotes(fresh = false): Promise<NoteIndexRow[]> {
  if (fresh || !cached || Date.now() - cached.at > 2000) {
    cached = {
      at: Date.now(),
      rows: Promise.all(NOTE_WORKSPACES.map((w) => window.api.notes.list(w))).then((lists) =>
        lists.flat()
      )
    }
  }
  return cached.rows
}

const detailOf = (row: NoteIndexRow): string =>
  `${groupLabel(row.group, row.subgroup) || 'Ungrouped'} · ${WORKSPACE_LABEL[row.workspace]}`

/** Notes a note can mention, in either workspace, by the `uid` in their front matter. */
export const noteEntities: EntityProvider = {
  kind: 'note',
  heading: 'Notes',
  noun: 'note',
  icon: StickyNote,
  async search(query, limit, self) {
    const rows = await allNotes()
    return nameFirst(
      queryNotes(rows, { ...DEFAULT_NOTES_QUERY, search: query }),
      displayTitle,
      query
    )
      .filter(
        (row) => !(self?.kind === 'note' && self.workspace === row.workspace && self.id === row.id)
      )
      .slice(0, limit)
      .map((row) => ({
        id: `${row.workspace}/${row.id}`,
        title: displayTitle(row),
        detail: detailOf(row),
        label: displayTitle(row),
        prepare: async () => ({
          kind: 'note' as const,
          key: await window.api.notes.ensureUid({ workspace: row.workspace, id: row.id })
        })
      }))
  },
  async resolve(key) {
    // A note linked a moment ago got its uid after the cached list was read, so look again before calling it gone.
    const row =
      (await allNotes()).find((r) => r.uid === key) ??
      (await allNotes(true)).find((r) => r.uid === key)
    if (!row) return null
    return {
      title: displayTitle(row),
      detail: detailOf(row),
      route: noteRoute(row.workspace, row.id)
    }
  }
}
