import { readdir } from 'fs/promises'
import type { Database } from 'better-sqlite3'
import type { NoteContent } from '@shared/notes'
import {
  createNoteFileExclusive,
  readNoteFile,
  renameNoteFileExclusive,
  writeNoteFileGuarded
} from '../../../main/notes/guarded-file'
import {
  NEW_MEETING_BODY,
  applyChanges,
  isValidDate,
  normaliseTime,
  parseMeta,
  splitNote,
  updateHead,
  type MeetingChanges,
  type MetaPatch
} from '../shared/front-matter'
import type {
  CreateMeetingInput,
  MeetingFile,
  MeetingSaveResult,
  SyncPreviousResult
} from '../shared/api'
import { carryOver, findPreviousMeeting } from '../shared/carry-over'
import {
  MEETING_MODES,
  MEETING_WORKSPACES,
  SERIES,
  type MeetingRef,
  type MeetingWorkspace
} from '../shared/types'
import { idFromFileName, meetingBaseName, meetingPath } from './file-name'
import { buildIndexRow } from './index-row'
import { deleteMeetingRow, listMeetingIds, listMeetingRows, upsertMeeting } from './repository'

/** A request the store refuses because of what it says, not because of the disk. */
export class MeetingError extends Error {}

interface MeetingsStoreOptions {
  db: Database
  /** The folder holding one workspace's meeting files. */
  dirFor: (workspace: MeetingWorkspace) => string
  /** Moves a file to the operating system's Trash (Electron's `shell.trashItem`). Injected so tests need no Electron. */
  trash: (path: string) => Promise<void>
}

function checkWorkspace(workspace: string): MeetingWorkspace {
  if (!(MEETING_WORKSPACES as readonly string[]).includes(workspace)) {
    throw new MeetingError(`Unknown workspace: ${workspace}`)
  }
  return workspace as MeetingWorkspace
}

/** Refuse metadata that could not be read back: the file is only ever given values the app understands. */
function checkPatch(patch: MetaPatch): void {
  if (patch.series !== undefined && !(SERIES as readonly string[]).includes(patch.series)) {
    throw new MeetingError(`Unknown series: ${patch.series}`)
  }
  if (patch.date !== undefined && !isValidDate(patch.date)) {
    throw new MeetingError(`Invalid date: ${patch.date}`)
  }
  for (const key of ['start', 'end'] as const) {
    const value = patch[key]
    if (value !== undefined && value !== null && normaliseTime(value) !== value) {
      throw new MeetingError(`Invalid ${key} time: ${value}`)
    }
  }
  if (patch.mode !== undefined && patch.mode !== null && !MEETING_MODES.includes(patch.mode)) {
    throw new MeetingError(`Unknown mode: ${patch.mode}`)
  }
  for (const key of ['attendees', 'discussed'] as const) {
    const value = patch[key]
    if (
      value !== undefined &&
      (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
    ) {
      throw new MeetingError(`${key} must be a list of names`)
    }
  }
}

/**
 * Creates, reads and saves meeting note files, and keeps the database index in step.
 *
 * The files are the source of truth and may be edited by other tools, so a save only goes through if
 * the file still holds what the caller last saw, and a new file never replaces an existing one.
 */
export class MeetingsStore {
  private readonly db: Database
  private readonly dirFor: (workspace: MeetingWorkspace) => string
  private readonly trash: (path: string) => Promise<void>

  constructor({ db, dirFor, trash }: MeetingsStoreOptions) {
    this.db = db
    this.dirFor = dirFor
    this.trash = trash
  }

  private pathOf(ref: MeetingRef): string {
    return meetingPath(this.dirFor(checkWorkspace(ref.workspace)), ref.id)
  }

  /** Create a meeting. The file name is derived from the date and series and made unique. */
  async create(input: CreateMeetingInput): Promise<MeetingFile> {
    const workspace = checkWorkspace(input.workspace)
    const patch: MetaPatch = {
      series: input.series,
      date: input.date,
      start: input.start ?? null,
      end: input.end ?? null,
      mode: input.mode ?? null,
      attendees: input.attendees ?? []
    }
    checkPatch(patch)
    const head = updateHead('', patch)

    const dir = this.dirFor(workspace)
    // Names already taken, from the folder itself (not just the index) so nothing is ever replaced.
    for (let attempt = 0; attempt < 50; attempt++) {
      const taken = await this.baseNamesOnDisk(workspace)
      const id = meetingBaseName(input.date, input.series, taken)
      const body =
        input.body ??
        (await this.templateBody({ workspace, id, series: input.series, date: input.date }))
      if (await createNoteFileExclusive(meetingPath(dir, id), head + body)) {
        await this.reindex({ workspace, id })
        return this.read({ workspace, id })
      }
    }
    throw new MeetingError('Could not find a free file name for the new meeting')
  }

  /** The standard new-meeting body, with Previous TODOs filled from the previous meeting of the series. */
  private async templateBody(key: {
    workspace: MeetingWorkspace
    id: string
    series: string
    date: string
  }): Promise<string> {
    const previous = await this.previousBody(key)
    return previous === null ? NEW_MEETING_BODY : carryOver(previous, NEW_MEETING_BODY).body
  }

  /** The body of the meeting before `key` in its series, or null if there is none. */
  private async previousBody(key: {
    workspace: MeetingWorkspace
    id: string
    series: string
    date: string
  }): Promise<string | null> {
    const rows = listMeetingRows(this.db, key.workspace)
    const previous = findPreviousMeeting(rows, key)
    if (!previous) return null
    const note = await readNoteFile(this.pathOf({ workspace: key.workspace, id: previous.id }))
    return note.exists ? splitNote(note.content).body : null
  }

  async read(ref: MeetingRef): Promise<MeetingFile> {
    const note = await readNoteFile(this.pathOf(ref))
    if (!note.exists) throw new MeetingError(`Meeting not found: ${ref.id}`)
    return toMeetingFile(ref, note)
  }

  /**
   * Apply `changes` to the meeting's file, provided it still matches `baseHash`. Whatever is not
   * being changed is written back exactly as it was. A missing file is an error, never created here.
   */
  async save(
    ref: MeetingRef,
    changes: MeetingChanges,
    baseHash: string
  ): Promise<MeetingSaveResult> {
    if (changes.meta) checkPatch(changes.meta)
    if (changes.body !== undefined && typeof changes.body !== 'string') {
      throw new MeetingError('The body must be text')
    }
    const path = this.pathOf(ref)
    const disk = await readNoteFile(path)
    if (!disk.exists) throw new MeetingError(`Meeting not found: ${ref.id}`)

    // The guarded write re-checks `baseHash` against the file, so a stale `disk` can never be saved over.
    const next = applyChanges(disk.content, changes)
    const { result, wrote } = await writeNoteFileGuarded(path, next, baseHash)
    if (wrote) await this.reindex(ref)
    if (wrote && result.status === 'saved' && (changes.meta?.date || changes.meta?.series)) {
      const renamedTo = await this.renameToMatch(ref, next)
      if (renamedTo) return { ...result, renamedTo }
    }
    return result
  }

  /**
   * Give a meeting's file the name its date and series call for (`YYYY-MM-DD Series`, with ` 2` when that
   * is taken), so file names stay consistent after the date or series is edited. Never replaces a file;
   * if the rename fails the note is still saved under its old name. Returns the new id, or null.
   */
  private async renameToMatch(ref: MeetingRef, content: string): Promise<string | null> {
    const { meta } = parseMeta(splitNote(content).head)
    if (!meta.date || !meta.series) return null
    const dir = this.dirFor(ref.workspace)
    try {
      for (let attempt = 0; attempt < 50; attempt++) {
        const others = (await this.baseNamesOnDisk(ref.workspace)).filter((id) => id !== ref.id)
        const id = meetingBaseName(meta.date, meta.series, others)
        if (id === ref.id) return null
        if (await renameNoteFileExclusive(meetingPath(dir, ref.id), meetingPath(dir, id))) {
          deleteMeetingRow(this.db, ref.workspace, ref.id)
          await this.reindex({ workspace: ref.workspace, id })
          return id
        }
      }
    } catch (error) {
      console.error('Could not rename the meeting file:', error)
    }
    return null
  }

  /** See `MeetingsApi.syncPreviousTodos`. Adds only, and only if the file still matches `baseHash`. */
  async syncPreviousTodos(ref: MeetingRef, baseHash: string): Promise<SyncPreviousResult> {
    const file = await this.read(ref)
    if (file.note.hash !== baseHash) return { status: 'conflict', disk: file.note }
    const previous = await this.previousBody({
      workspace: ref.workspace,
      id: ref.id,
      series: file.meta.series,
      date: file.meta.date
    })
    if (previous === null) return { status: 'saved', hash: file.note.hash, added: 0 }
    const { body, added } = carryOver(previous, file.body)
    const result = await this.save(ref, { body }, baseHash)
    return result.status === 'saved'
      ? { status: 'saved', hash: result.hash, added: added.length }
      : result
  }

  /**
   * Move a meeting's file to the Trash and drop its index row. This is the only way the app removes
   * a note, and only ever on the user's explicit request (the interface asks first). Nothing is
   * deleted outright: the file stays recoverable from the Trash. If the move fails the file and its
   * row are left as they were.
   */
  async delete(ref: MeetingRef): Promise<void> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) {
      deleteMeetingRow(this.db, ref.workspace, ref.id)
      throw new MeetingError(`Meeting not found: ${ref.id}`)
    }
    await this.trash(path)
    deleteMeetingRow(this.db, ref.workspace, ref.id)
  }

  /** Recompute one meeting's index row from its file; a file that is gone loses its row. */
  async reindex(ref: MeetingRef): Promise<void> {
    const note = await readNoteFile(this.pathOf(ref))
    if (!note.exists) deleteMeetingRow(this.db, ref.workspace, ref.id)
    else upsertMeeting(this.db, buildIndexRow(ref.workspace, ref.id, note.content))
  }

  /** Reindex the meeting owning `fileName` (e.g. "2026-09-24 Supervision.md"), if it is a meeting file. */
  async reindexFile(workspace: MeetingWorkspace, fileName: string): Promise<MeetingRef | null> {
    const id = idFromFileName(fileName)
    if (!id) return null
    const ref = { workspace, id }
    await this.reindex(ref)
    return ref
  }

  /** Bring the index in line with the folder: add and refresh every file, drop rows for missing ones. */
  async reindexAll(workspace: MeetingWorkspace): Promise<void> {
    const onDisk = await this.baseNamesOnDisk(workspace)
    for (const id of onDisk) await this.reindex({ workspace, id })
    const present = new Set(onDisk)
    for (const id of listMeetingIds(this.db, workspace)) {
      if (!present.has(id)) deleteMeetingRow(this.db, workspace, id)
    }
  }

  private async baseNamesOnDisk(workspace: MeetingWorkspace): Promise<string[]> {
    try {
      return (await readdir(this.dirFor(workspace)))
        .map(idFromFileName)
        .filter((id): id is string => id !== null)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }
}

export function toMeetingFile(ref: MeetingRef, note: NoteContent): MeetingFile {
  const { head, body } = splitNote(note.content)
  const { meta, problems } = parseMeta(head)
  return { ref, note, meta, body, problems }
}
