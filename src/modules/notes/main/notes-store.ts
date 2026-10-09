import { readdir, rm, stat } from 'fs/promises'
import type { Database } from 'better-sqlite3'
import type { NoteContent } from '@shared/notes'
import {
  createNoteFileExclusive,
  readNoteFile,
  renameNoteFileExclusive,
  writeNoteFileGuarded
} from '../../../main/notes/guarded-file'
import { moveNoteFile } from '../../../main/notes/move-file'
import { addUid, newUid, readUid } from '@shared/entities'
import { parseHead } from '@shared/front-matter'
import {
  NEW_NOTE_BODY,
  applyChanges,
  joinNote,
  parseMeta,
  splitNote,
  updateHead,
  type MetaPatch,
  type NoteChanges
} from '../shared/front-matter'
import type { CreateNoteInput, NoteFile, NoteSaveResult } from '../shared/api'
import { isValidName, resolveNames } from '../shared/groups'
import { canPin } from '../shared/pinning'
import { NOTE_WORKSPACES, type NoteRef, type NoteWorkspace } from '../shared/types'
import { idFromFileName, nameMatchesTitle, noteBaseName, notesPath } from './file-name'
import { buildIndexRow } from './index-row'
import { deleteNoteRow, listNoteIds, listNoteRows, upsertNote } from './repository'

/** A request the store refuses because of what it says, not because of the disk. */
export class NoteError extends Error {}

const MAX_TITLE_LENGTH = 200

interface NotesStoreOptions {
  db: Database
  /** The folder holding one workspace's note files. */
  dirFor: (workspace: NoteWorkspace) => string
  /** Moves a file to the operating system's Trash (Electron's `shell.trashItem`). Injected so tests need no Electron. */
  trash: (path: string) => Promise<void>
}

function checkWorkspace(workspace: string): NoteWorkspace {
  if (!(NOTE_WORKSPACES as readonly string[]).includes(workspace)) {
    throw new NoteError(`Unknown workspace: ${workspace}`)
  }
  return workspace as NoteWorkspace
}

/** Refuse metadata that could not be read back: the file is only ever given values the app understands. */
function checkPatch(patch: MetaPatch): void {
  if (patch.title !== undefined) {
    if (typeof patch.title !== 'string' || /[\r\n]/.test(patch.title)) {
      throw new NoteError('The title must be one line of text')
    }
    if (patch.title.length > MAX_TITLE_LENGTH) throw new NoteError('The title is too long')
  }
  for (const key of ['group', 'subgroup'] as const) {
    const value = patch[key]
    if (value === undefined || value === '') continue
    if (typeof value !== 'string' || !isValidName(value)) {
      throw new NoteError(`Invalid ${key}: ${String(value)}`)
    }
  }
  if (patch.pinned !== undefined && typeof patch.pinned !== 'boolean') {
    throw new NoteError('Pinned must be true or false')
  }
}

/**
 * Creates, reads and saves note files, and keeps the database index in step.
 *
 * The files are the source of truth and may be edited by other tools, so a save only goes through if
 * the file still holds what the caller last saw, and a new file never replaces an existing one.
 */
export class NotesStore {
  private readonly db: Database
  private readonly dirFor: (workspace: NoteWorkspace) => string
  private readonly trash: (path: string) => Promise<void>

  constructor({ db, dirFor, trash }: NotesStoreOptions) {
    this.db = db
    this.dirFor = dirFor
    this.trash = trash
  }

  private pathOf(ref: NoteRef): string {
    return notesPath(this.dirFor(checkWorkspace(ref.workspace)), ref.id)
  }

  /** Create a note. The file name follows the title and is made unique. */
  async create(input: CreateNoteInput): Promise<NoteFile> {
    const workspace = checkWorkspace(input.workspace)
    const title = (input.title ?? '').trim()
    const rows = listNoteRows(this.db, workspace)
    const names = resolveNames(rows, input.group ?? '', input.subgroup ?? '')
    const patch: MetaPatch = { title, ...names }
    checkPatch(patch)
    // A note with nothing to record starts with no front matter block at all.
    const head = Object.values(patch).some((v) => v) ? updateHead('', patch) : ''
    const body = input.body ?? NEW_NOTE_BODY

    const dir = this.dirFor(workspace)
    // Names already taken, from the folder itself (not just the index) so nothing is ever replaced.
    for (let attempt = 0; attempt < 50; attempt++) {
      const id = noteBaseName(title, await this.baseNamesOnDisk(workspace))
      if (await createNoteFileExclusive(notesPath(dir, id), head + body)) {
        await this.reindex({ workspace, id })
        return this.read({ workspace, id })
      }
    }
    throw new NoteError('Couldn’t find a free file name for the new note')
  }

  async read(ref: NoteRef): Promise<NoteFile> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) throw new NoteError(`Note not found: ${ref.id}`)
    return toNoteFile(ref, note, (await stat(path)).mtimeMs)
  }

  /**
   * Apply `changes` to the note's file, provided it still matches `baseHash`. Whatever is not being
   * changed is written back exactly as it was. A missing file is an error, never created here.
   */
  async save(ref: NoteRef, changes: NoteChanges, baseHash: string): Promise<NoteSaveResult> {
    if (changes.meta) checkPatch(changes.meta)
    if (changes.body !== undefined && typeof changes.body !== 'string') {
      throw new NoteError('The body must be text')
    }
    const path = this.pathOf(ref)
    const disk = await readNoteFile(path)
    if (!disk.exists) throw new NoteError(`Note not found: ${ref.id}`)

    const patch = changes.meta ? this.settle(ref, disk.content, changes.meta) : undefined
    // The guarded write re-checks `baseHash` against the file, so a stale `disk` can never be saved over.
    const next = applyChanges(disk.content, { ...changes, meta: patch })
    const { result, wrote } = await writeNoteFileGuarded(path, next, baseHash)
    if (wrote) await this.reindex(ref)
    if (wrote && result.status === 'saved' && patch && 'title' in patch) {
      const renamedTo = await this.renameToMatch(ref, next)
      if (renamedTo) return { ...result, renamedTo }
    }
    return result
  }

  /**
   * The patch with the rules of groups and pinning applied: names get the spelling the notes already use, a
   * note moved to another group leaves its old subgroup behind, and a fifth note cannot be pinned.
   */
  private settle(ref: NoteRef, current: string, patch: MetaPatch): MetaPatch {
    const settled = { ...patch }
    if ('group' in patch || 'subgroup' in patch) {
      const now = parseMeta(splitNote(current).head).meta
      const group = 'group' in patch ? (patch.group ?? '') : now.group
      const subgroup =
        'subgroup' in patch ? (patch.subgroup ?? '') : 'group' in patch ? '' : now.subgroup
      const others = listNoteRows(this.db, ref.workspace).filter((r) => r.id !== ref.id)
      Object.assign(settled, resolveNames(others, group, subgroup))
    }
    if (patch.pinned === true) {
      const rows = listNoteRows(this.db, ref.workspace)
      if (!canPin(rows, ref.id)) throw new NoteError('Four notes are pinned already')
    }
    return settled
  }

  /**
   * Give a note's file the name its title calls for (`Title`, with ` 2` when that is taken), so file names
   * stay consistent after the title is edited. A name that already fits (the title, or the title with a
   * number) is left alone. Never replaces a file; if the rename fails the note is still saved under its old
   * name. Returns the new id, or null.
   */
  private async renameToMatch(ref: NoteRef, content: string): Promise<string | null> {
    const { meta } = parseMeta(splitNote(content).head)
    if (nameMatchesTitle(ref.id, meta.title)) return null
    const dir = this.dirFor(ref.workspace)
    try {
      for (let attempt = 0; attempt < 50; attempt++) {
        const others = (await this.baseNamesOnDisk(ref.workspace)).filter((id) => id !== ref.id)
        const id = noteBaseName(meta.title, others)
        if (id === ref.id) return null
        if (await renameNoteFileExclusive(notesPath(dir, ref.id), notesPath(dir, id))) {
          deleteNoteRow(this.db, ref.workspace, ref.id)
          await this.reindex({ workspace: ref.workspace, id })
          return id
        }
      }
    } catch (error) {
      console.error('Could not rename the note file:', error)
    }
    return null
  }

  /**
   * Move a note's file to the Trash and drop its index row. This is the only way the app removes a note,
   * and only ever on the user's explicit request (the interface asks first). Nothing is deleted outright:
   * the file stays recoverable from the Trash. If the move fails the file and its row are left as they were.
   */
  async delete(ref: NoteRef): Promise<void> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) {
      deleteNoteRow(this.db, ref.workspace, ref.id)
      throw new NoteError(`Note not found: ${ref.id}`)
    }
    await this.trash(path)
    deleteNoteRow(this.db, ref.workspace, ref.id)
  }

  /**
   * The id mentions of this note use, written into its front matter the first time it is asked for (only a note something
   * links to ever gets one). Written under the same hash guard as every save: if the file changed meanwhile nothing is
   * written and the caller is told to try again. The uid never changes once there, and moves keep it (the file is copied).
   */
  async ensureUid(ref: NoteRef): Promise<string> {
    const path = this.pathOf(ref)
    const disk = await readNoteFile(path)
    if (!disk.exists) throw new NoteError(`Note not found: ${ref.id}`)
    const { head, body } = splitNote(disk.content)
    const existing = readUid(head)
    if (existing) return existing
    const taken = new Set(
      NOTE_WORKSPACES.flatMap((w) => listNoteRows(this.db, w).map((r) => r.uid))
    )
    let uid = newUid()
    while (taken.has(uid)) uid = newUid()
    const { result, wrote } = await writeNoteFileGuarded(
      path,
      joinNote({ head: addUid(head, uid), body }),
      disk.hash
    )
    if (result.status === 'conflict' || !wrote) {
      throw new NoteError('The note changed while it was being linked; try again')
    }
    await this.reindex(ref)
    return uid
  }

  /**
   * Move a note to the other workspace: the same text and fields, filed under the name its title calls for there.
   * The whole file is copied as it is on disk (so nothing pending is lost, as long as the caller saved first), except that a
   * pinned note arrives unpinned when the other workspace already has four pinned. Never replaces a file there, and
   * the original goes to the Trash only once the copy exists (see `moveNoteFile`). Returns the note as it is now.
   */
  async move(ref: NoteRef, to: NoteWorkspace): Promise<NoteFile> {
    const target = checkWorkspace(to)
    if (target === checkWorkspace(ref.workspace)) throw new NoteError('The note is already there')
    const sourcePath = this.pathOf(ref)
    const disk = await readNoteFile(sourcePath)
    if (!disk.exists) throw new NoteError(`Note not found: ${ref.id}`)
    const { meta } = parseMeta(splitNote(disk.content).head)
    const content =
      meta.pinned && !canPin(listNoteRows(this.db, target), '')
        ? applyChanges(disk.content, { meta: { pinned: false } })
        : disk.content
    const dir = this.dirFor(target)
    const id = await moveNoteFile({
      sourcePath,
      content,
      pickTarget: async () => {
        const name = noteBaseName(meta.title, await this.baseNamesOnDisk(target))
        return { id: name, path: notesPath(dir, name) }
      },
      trash: this.trash
    })
    deleteNoteRow(this.db, ref.workspace, ref.id)
    await this.reindex({ workspace: target, id })
    return this.read({ workspace: target, id })
  }

  /**
   * Remove a note that was made and never written in: no title, no text, not pinned, and no front matter beyond
   * what the app itself writes (so an imported note, or one with keys from another tool, is never touched).
   * The only case where a note file is deleted without the Trash: there is nothing in it to keep, and a Trash full
   * of empty `Untitled` files would only be clutter. Returns whether the file was removed.
   */
  async discardIfEmpty(ref: NoteRef): Promise<boolean> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) return false
    const { head, body } = splitNote(note.content)
    const { meta } = parseMeta(head)
    // `created` is no longer kept, but an older empty note may still carry it: that is not something to keep.
    const owned = ['title', 'group', 'subgroup', 'pinned', 'created']
    const foreign = parseHead(head)?.entries.some((e) => !owned.includes(e.key)) ?? false
    if (meta.title || meta.pinned || body.trim() !== '' || foreign) return false
    await rm(path)
    deleteNoteRow(this.db, ref.workspace, ref.id)
    return true
  }

  /** Recompute one note's index row from its file; a file that is gone loses its row. */
  async reindex(ref: NoteRef): Promise<void> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) return deleteNoteRow(this.db, ref.workspace, ref.id)
    let edited: number
    try {
      edited = (await stat(path)).mtimeMs
    } catch {
      return deleteNoteRow(this.db, ref.workspace, ref.id)
    }
    upsertNote(this.db, buildIndexRow(ref.workspace, ref.id, note.content, edited))
  }

  /** Reindex the note owning `fileName` (e.g. "Methods participants.md"), if it is a note file. */
  async reindexFile(workspace: NoteWorkspace, fileName: string): Promise<NoteRef | null> {
    const id = idFromFileName(fileName)
    if (!id) return null
    const ref = { workspace, id }
    await this.reindex(ref)
    return ref
  }

  /** Bring the index in line with the folder: add and refresh every file, drop rows for missing ones. */
  async reindexAll(workspace: NoteWorkspace): Promise<void> {
    const onDisk = await this.baseNamesOnDisk(workspace)
    for (const id of onDisk) await this.reindex({ workspace, id })
    this.dropRowsWithoutFiles(workspace, onDisk)
  }

  /**
   * Drop the index rows of files that are no longer there, without reading any file (one directory listing).
   * Cheap enough to run before every list, which keeps the list right even if the folder watcher missed a
   * deletion.
   */
  async pruneMissing(workspace: NoteWorkspace): Promise<void> {
    this.dropRowsWithoutFiles(workspace, await this.baseNamesOnDisk(workspace))
  }

  private dropRowsWithoutFiles(workspace: NoteWorkspace, onDisk: readonly string[]): void {
    const present = new Set(onDisk)
    for (const id of listNoteIds(this.db, workspace)) {
      if (!present.has(id)) deleteNoteRow(this.db, workspace, id)
    }
  }

  private async baseNamesOnDisk(workspace: NoteWorkspace): Promise<string[]> {
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

export function toNoteFile(ref: NoteRef, note: NoteContent, edited: number): NoteFile {
  const { head, body } = splitNote(note.content)
  const { meta, problems } = parseMeta(head)
  return { ref, note, meta, body, edited: Math.floor(edited), problems }
}
