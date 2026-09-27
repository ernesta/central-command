import { readdir, stat } from 'fs/promises'
import type { Database } from 'better-sqlite3'
import type { NoteContent } from '@shared/notes'
import {
  createNoteFileExclusive,
  readNoteFile,
  renameNoteFileExclusive,
  writeNoteFileGuarded
} from '../../../main/notes/guarded-file'
import {
  NEW_LIST_BODY,
  applyChanges,
  parseMeta,
  splitNote,
  updateHead,
  type ListChanges,
  type MetaPatch
} from '../shared/front-matter'
import type { CreateListInput, ReadingListFile, ReadingListSaveResult } from '../shared/api'
import {
  READING_LIST_WORKSPACES,
  type ReadingListRef,
  type ReadingListWorkspace
} from '../shared/types'
import { idFromFileName, listBaseName, listPath, nameMatchesTitle } from './file-name'
import { buildIndexRow } from './index-row'
import { deleteListRow, listListIds, upsertList } from './repository'

/** A request the store refuses because of what it says, not because of the disk. */
export class ReadingListError extends Error {}

const MAX_TITLE_LENGTH = 200

interface ReadingListStoreOptions {
  db: Database
  /** The folder holding one workspace's list files. */
  dirFor: (workspace: ReadingListWorkspace) => string
  /** Moves a file to the operating system's Trash (Electron's `shell.trashItem`). Injected so tests need no Electron. */
  trash: (path: string) => Promise<void>
}

function checkWorkspace(workspace: string): ReadingListWorkspace {
  if (!(READING_LIST_WORKSPACES as readonly string[]).includes(workspace)) {
    throw new ReadingListError(`Unknown workspace: ${workspace}`)
  }
  return workspace as ReadingListWorkspace
}

function checkPatch(patch: MetaPatch): void {
  if (patch.title !== undefined) {
    if (typeof patch.title !== 'string' || /[\r\n]/.test(patch.title)) {
      throw new ReadingListError('The title must be one line of text')
    }
    if (patch.title.length > MAX_TITLE_LENGTH) throw new ReadingListError('The title is too long')
  }
}

/**
 * Creates, reads and saves reading list files, and keeps the database index (and its reverse index of
 * which reading is mentioned where) in step.
 *
 * The files are the source of truth and may be edited by other tools, so a save only goes through if
 * the file still holds what the caller last saw, and a new file never replaces an existing one.
 */
export class ReadingListStore {
  private readonly db: Database
  private readonly dirFor: (workspace: ReadingListWorkspace) => string
  private readonly trash: (path: string) => Promise<void>

  constructor({ db, dirFor, trash }: ReadingListStoreOptions) {
    this.db = db
    this.dirFor = dirFor
    this.trash = trash
  }

  private pathOf(ref: ReadingListRef): string {
    return listPath(this.dirFor(checkWorkspace(ref.workspace)), ref.id)
  }

  /** Create a list. The file name follows the title and is made unique. */
  async create(input: CreateListInput): Promise<ReadingListFile> {
    const workspace = checkWorkspace(input.workspace)
    const title = (input.title ?? '').trim()
    const patch: MetaPatch = { title }
    checkPatch(patch)
    const head = updateHead('', patch)
    const body = NEW_LIST_BODY

    const dir = this.dirFor(workspace)
    for (let attempt = 0; attempt < 50; attempt++) {
      const id = listBaseName(title, await this.baseNamesOnDisk(workspace))
      if (await createNoteFileExclusive(listPath(dir, id), head + body)) {
        await this.reindex({ workspace, id })
        return this.read({ workspace, id })
      }
    }
    throw new ReadingListError('Could not find a free file name for the new list')
  }

  async read(ref: ReadingListRef): Promise<ReadingListFile> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) throw new ReadingListError(`Reading list not found: ${ref.id}`)
    return toListFile(ref, note, (await stat(path)).mtimeMs)
  }

  /**
   * Apply `changes` to the list's file, provided it still matches `baseHash`. Whatever is not being
   * changed is written back exactly as it was. A missing file is an error, never created here.
   */
  async save(
    ref: ReadingListRef,
    changes: ListChanges,
    baseHash: string
  ): Promise<ReadingListSaveResult> {
    if (changes.meta) checkPatch(changes.meta)
    if (changes.body !== undefined && typeof changes.body !== 'string') {
      throw new ReadingListError('The body must be text')
    }
    const path = this.pathOf(ref)
    const disk = await readNoteFile(path)
    if (!disk.exists) throw new ReadingListError(`Reading list not found: ${ref.id}`)

    const next = applyChanges(disk.content, changes)
    const { result, wrote } = await writeNoteFileGuarded(path, next, baseHash)
    if (wrote) await this.reindex(ref)
    if (wrote && result.status === 'saved' && changes.meta && 'title' in changes.meta) {
      const renamedTo = await this.renameToMatch(ref, next)
      if (renamedTo) return { ...result, renamedTo }
    }
    return result
  }

  /**
   * Give a list's file the name its title calls for, so file names stay consistent after the title is
   * edited. A name that already fits is left alone. Never replaces a file; if the rename fails the list
   * is still saved under its old name. Returns the new id, or null.
   */
  private async renameToMatch(ref: ReadingListRef, content: string): Promise<string | null> {
    const { meta } = parseMeta(splitNote(content).head)
    if (nameMatchesTitle(ref.id, meta.title)) return null
    const dir = this.dirFor(ref.workspace)
    try {
      for (let attempt = 0; attempt < 50; attempt++) {
        const others = (await this.baseNamesOnDisk(ref.workspace)).filter((id) => id !== ref.id)
        const id = listBaseName(meta.title, others)
        if (id === ref.id) return null
        if (await renameNoteFileExclusive(listPath(dir, ref.id), listPath(dir, id))) {
          deleteListRow(this.db, ref.workspace, ref.id)
          await this.reindex({ workspace: ref.workspace, id })
          return id
        }
      }
    } catch (error) {
      console.error('Could not rename the reading list file:', error)
    }
    return null
  }

  /**
   * Move a list's file to the Trash and drop its index row. This is the only way the app removes a
   * list, and only ever on the user's explicit request. Nothing is deleted outright: the file stays
   * recoverable from the Trash.
   */
  async delete(ref: ReadingListRef): Promise<void> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) {
      deleteListRow(this.db, ref.workspace, ref.id)
      throw new ReadingListError(`Reading list not found: ${ref.id}`)
    }
    await this.trash(path)
    deleteListRow(this.db, ref.workspace, ref.id)
  }

  /** Recompute one list's index row (and its mentions) from its file; a file that is gone loses its row. */
  async reindex(ref: ReadingListRef): Promise<void> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) return deleteListRow(this.db, ref.workspace, ref.id)
    let edited: number
    try {
      edited = (await stat(path)).mtimeMs
    } catch {
      return deleteListRow(this.db, ref.workspace, ref.id)
    }
    const { row, mentions } = buildIndexRow(ref.workspace, ref.id, note.content, edited)
    upsertList(this.db, row, mentions)
  }

  /** Reindex the list owning `fileName` (e.g. "Shortlist.md"), if it is a list file. */
  async reindexFile(
    workspace: ReadingListWorkspace,
    fileName: string
  ): Promise<ReadingListRef | null> {
    const id = idFromFileName(fileName)
    if (!id) return null
    const ref = { workspace, id }
    await this.reindex(ref)
    return ref
  }

  /** Bring the index in line with the folder: add and refresh every file, drop rows for missing ones. */
  async reindexAll(workspace: ReadingListWorkspace): Promise<void> {
    const onDisk = await this.baseNamesOnDisk(workspace)
    for (const id of onDisk) await this.reindex({ workspace, id })
    this.dropRowsWithoutFiles(workspace, onDisk)
  }

  /** Drop the index rows of files that are no longer there, without reading any file. */
  async pruneMissing(workspace: ReadingListWorkspace): Promise<void> {
    this.dropRowsWithoutFiles(workspace, await this.baseNamesOnDisk(workspace))
  }

  private dropRowsWithoutFiles(workspace: ReadingListWorkspace, onDisk: readonly string[]): void {
    const present = new Set(onDisk)
    for (const id of listListIds(this.db, workspace)) {
      if (!present.has(id)) deleteListRow(this.db, workspace, id)
    }
  }

  private async baseNamesOnDisk(workspace: ReadingListWorkspace): Promise<string[]> {
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

export function toListFile(
  ref: ReadingListRef,
  note: NoteContent,
  edited: number
): ReadingListFile {
  const { head, body } = splitNote(note.content)
  const { meta } = parseMeta(head)
  return { ref, note, meta, body, edited: Math.floor(edited) }
}
