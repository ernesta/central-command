import { File, StickyNote } from 'lucide-react'
import { nameFirst } from '@shared/search'
import { fold } from '@shared/text'
import type { EntityFile } from '@shared/entity-files'
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

const FILE_WORKSPACE_LABEL: Record<string, string> = {
  research: 'Research',
  work: 'Work',
  life: 'Life'
}

const sizeLabel = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`

const fileDetail = (file: EntityFile): string =>
  `${FILE_WORKSPACE_LABEL[file.workspace] ?? file.workspace} · ${sizeLabel(file.size)}`

/** Files kept beside the notes (a spreadsheet, a PDF) that a note can link to; opening one hands it to the Mac. */
export const fileEntities: EntityProvider = {
  kind: 'file',
  heading: 'Files',
  noun: 'file',
  icon: File,
  async search(query, limit) {
    const files = await window.api.entities.listFiles()
    const terms = fold(query).split(/\s+/).filter(Boolean)
    const matching = files.filter((f) => {
      const text = fold(f.name)
      return terms.every((term) => text.includes(term))
    })
    return nameFirst(matching, (f) => f.name, query)
      .slice(0, limit)
      .map((f) => ({
        id: f.key,
        title: f.name,
        detail: fileDetail(f),
        label: f.name,
        prepare: async () => ({ kind: 'file' as const, key: f.key })
      }))
  },
  async resolve(key) {
    const file = await window.api.entities.fileInfo(key)
    if (!file) return null
    return {
      title: file.name,
      detail: fileDetail(file),
      open: () => window.api.entities.openFile(key)
    }
  }
}
