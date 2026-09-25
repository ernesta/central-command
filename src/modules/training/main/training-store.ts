import { readdir } from 'fs/promises'
import type { Database } from 'better-sqlite3'
import type { NoteContent } from '@shared/notes'
import { MAX_SKILLS } from '@shared/skills'
import {
  createNoteFileExclusive,
  readNoteFile,
  renameNoteFileExclusive,
  writeNoteFileGuarded
} from '../../../main/notes/guarded-file'
import type { CreateTrainingInput, TrainingFile, TrainingSaveResult } from '../shared/api'
import {
  NEW_TRAINING_BODY,
  applyTrainingChanges,
  isValidDate,
  normaliseTime,
  parseTrainingMeta,
  splitNote,
  updateTrainingHead,
  type TrainingChanges,
  type TrainingPatch
} from '../shared/front-matter'
import {
  TRAINING_MODES,
  TRAINING_TYPE_NAMES,
  TRAINING_WORKSPACES,
  type TrainingRef,
  type TrainingWorkspace
} from '../shared/types'
import { isSafeRelativeFolder } from './files'
import { idFromFileName, trainingBaseName, trainingPath } from './file-name'
import { buildTrainingIndexRow } from './index-row'
import { deleteTrainingRow, listTrainingIds, listTrainingRows, upsertTraining } from './repository'

/** A request the store refuses because of what it says, not because of the disk. */
export class TrainingError extends Error {}

interface TrainingStoreOptions {
  db: Database
  /** The folder holding one workspace's entry files. */
  dirFor: (workspace: TrainingWorkspace) => string
  /** Moves a file to the operating system's Trash (Electron's `shell.trashItem`). Injected so tests need no Electron. */
  trash: (path: string) => Promise<void>
}

function checkWorkspace(workspace: string): TrainingWorkspace {
  if (!(TRAINING_WORKSPACES as readonly string[]).includes(workspace)) {
    throw new TrainingError(`Unknown workspace: ${workspace}`)
  }
  return workspace as TrainingWorkspace
}

const isText = (v: unknown): v is string => typeof v === 'string'

/** Refuse metadata that could not be read back: the file is only ever given values the app understands. */
export function checkTrainingPatch(patch: TrainingPatch): void {
  if (patch.date !== undefined && !isValidDate(patch.date)) {
    throw new TrainingError(`Invalid date: ${patch.date}`)
  }
  for (const key of ['start', 'end'] as const) {
    const value = patch[key]
    if (value !== undefined && value !== null && normaliseTime(value) !== value) {
      throw new TrainingError(`Invalid ${key} time: ${value}`)
    }
  }
  if (patch.title !== undefined && (!isText(patch.title) || /[\r\n]/.test(patch.title))) {
    throw new TrainingError('The title must be one line of text')
  }
  for (const key of ['series', 'institution', 'organisation', 'review'] as const) {
    const value = patch[key]
    if (value !== undefined && value !== null && (!isText(value) || /[\r\n]/.test(value))) {
      throw new TrainingError(`${key} must be one line of text`)
    }
  }
  if (
    patch.type !== undefined &&
    patch.type !== null &&
    !TRAINING_TYPE_NAMES.includes(patch.type)
  ) {
    throw new TrainingError(`Unknown type: ${patch.type}`)
  }
  if (patch.mode !== undefined && patch.mode !== null && !TRAINING_MODES.includes(patch.mode)) {
    throw new TrainingError(`Unknown mode: ${patch.mode}`)
  }
  for (const key of ['skills', 'leads'] as const) {
    const value = patch[key]
    if (value !== undefined && (!Array.isArray(value) || value.some((v) => !isText(v)))) {
      throw new TrainingError(`${key} must be a list of names`)
    }
  }
  if (patch.skills !== undefined && patch.skills.length > MAX_SKILLS) {
    throw new TrainingError(`An entry has at most ${MAX_SKILLS} skills`)
  }
  if (patch.folder !== undefined && patch.folder !== null && !isSafeRelativeFolder(patch.folder)) {
    throw new TrainingError(
      `The folder must be a path inside the Trainings folder: ${patch.folder}`
    )
  }
  if (patch.points !== undefined && patch.points !== null && !/^\d+(\.\d+)?$/.test(patch.points)) {
    throw new TrainingError(`Points must be a number: ${patch.points}`)
  }
}

/**
 * Creates, reads and saves training entry files, and keeps the database index in step.
 *
 * The files are the source of truth and may be edited by other tools, so a save only goes through if
 * the file still holds what the caller last saw, and a new file never replaces an existing one.
 */
export class TrainingStore {
  private readonly db: Database
  private readonly dirFor: (workspace: TrainingWorkspace) => string
  private readonly trash: (path: string) => Promise<void>

  constructor({ db, dirFor, trash }: TrainingStoreOptions) {
    this.db = db
    this.dirFor = dirFor
    this.trash = trash
  }

  private pathOf(ref: TrainingRef): string {
    return trainingPath(this.dirFor(checkWorkspace(ref.workspace)), ref.id)
  }

  /** Create an entry. The file name is derived from the date and title and made unique. */
  async create(input: CreateTrainingInput): Promise<TrainingFile> {
    const workspace = checkWorkspace(input.workspace)
    const patch: TrainingPatch = {
      date: input.date,
      start: input.start ?? null,
      end: input.end ?? null,
      title: input.title,
      series: input.series ?? null,
      type: input.type ?? null,
      mode: input.mode ?? null,
      skills: input.skills ?? [],
      leads: input.leads ?? []
    }
    checkTrainingPatch(patch)
    const head = updateTrainingHead('', patch)
    const body = input.body ?? NEW_TRAINING_BODY
    const dir = this.dirFor(workspace)

    // Names already taken, from the folder itself (not just the index) so nothing is ever replaced.
    for (let attempt = 0; attempt < 50; attempt++) {
      const taken = await this.baseNamesOnDisk(workspace)
      const id = trainingBaseName(input.date, input.title, taken)
      if (await createNoteFileExclusive(trainingPath(dir, id), head + body)) {
        await this.reindex({ workspace, id })
        return this.read({ workspace, id })
      }
    }
    throw new TrainingError('Could not find a free file name for the new entry')
  }

  async read(ref: TrainingRef): Promise<TrainingFile> {
    const note = await readNoteFile(this.pathOf(ref))
    if (!note.exists) throw new TrainingError(`Training entry not found: ${ref.id}`)
    return toTrainingFile(ref, note)
  }

  /**
   * Apply `changes` to the entry's file, provided it still matches `baseHash`. Whatever is not being
   * changed is written back exactly as it was. A missing file is an error, never created here.
   */
  async save(
    ref: TrainingRef,
    changes: TrainingChanges,
    baseHash: string
  ): Promise<TrainingSaveResult> {
    if (changes.meta) checkTrainingPatch(changes.meta)
    if (changes.body !== undefined && typeof changes.body !== 'string') {
      throw new TrainingError('The body must be text')
    }
    const path = this.pathOf(ref)
    const disk = await readNoteFile(path)
    if (!disk.exists) throw new TrainingError(`Training entry not found: ${ref.id}`)

    // The guarded write re-checks `baseHash` against the file, so a stale `disk` can never be saved over.
    const next = applyTrainingChanges(disk.content, changes)
    const { result, wrote } = await writeNoteFileGuarded(path, next, baseHash)
    if (wrote) await this.reindex(ref)
    if (wrote && result.status === 'saved' && (changes.meta?.date || changes.meta?.title)) {
      const renamedTo = await this.renameToMatch(ref, next)
      if (renamedTo) return { ...result, renamedTo }
    }
    return result
  }

  /**
   * Give an entry's file the name its date and title call for (`YYYY-MM-DD Title`, with ` 2` when that
   * is taken), so file names stay consistent after either is edited. Never replaces a file; if the
   * rename fails the note is still saved under its old name. Returns the new id, or null.
   */
  private async renameToMatch(ref: TrainingRef, content: string): Promise<string | null> {
    const { meta } = parseTrainingMeta(splitNote(content).head)
    if (!meta.date || !meta.title) return null
    const dir = this.dirFor(ref.workspace)
    try {
      for (let attempt = 0; attempt < 50; attempt++) {
        const others = (await this.baseNamesOnDisk(ref.workspace)).filter((id) => id !== ref.id)
        const id = trainingBaseName(meta.date, meta.title, others)
        if (id === ref.id) return null
        if (await renameNoteFileExclusive(trainingPath(dir, ref.id), trainingPath(dir, id))) {
          deleteTrainingRow(this.db, ref.workspace, ref.id)
          await this.reindex({ workspace: ref.workspace, id })
          return id
        }
      }
    } catch (error) {
      console.error('Could not rename the training entry file:', error)
    }
    return null
  }

  /**
   * Move an entry's file to the Trash and drop its index row. This is the only way the app removes a
   * note, and only ever on the user's explicit request (the interface asks first). If the move fails
   * the file and its row are left as they were.
   */
  async delete(ref: TrainingRef): Promise<void> {
    const path = this.pathOf(ref)
    const note = await readNoteFile(path)
    if (!note.exists) {
      deleteTrainingRow(this.db, ref.workspace, ref.id)
      throw new TrainingError(`Training entry not found: ${ref.id}`)
    }
    await this.trash(path)
    deleteTrainingRow(this.db, ref.workspace, ref.id)
  }

  list(workspace: TrainingWorkspace): ReturnType<typeof listTrainingRows> {
    return listTrainingRows(this.db, checkWorkspace(workspace))
  }

  /** Recompute one entry's index row from its file; a file that is gone loses its row. */
  async reindex(ref: TrainingRef): Promise<void> {
    const note = await readNoteFile(this.pathOf(ref))
    if (!note.exists) deleteTrainingRow(this.db, ref.workspace, ref.id)
    else upsertTraining(this.db, buildTrainingIndexRow(ref.workspace, ref.id, note.content))
  }

  /** Reindex the entry owning `fileName` (e.g. "2025-12-10 Data Management.md"), if it is an entry file. */
  async reindexFile(workspace: TrainingWorkspace, fileName: string): Promise<TrainingRef | null> {
    const id = idFromFileName(fileName)
    if (!id) return null
    const ref = { workspace, id }
    await this.reindex(ref)
    return ref
  }

  /** Bring the index in line with the folder: add and refresh every file, drop rows for missing ones. */
  async reindexAll(workspace: TrainingWorkspace): Promise<void> {
    const onDisk = await this.baseNamesOnDisk(workspace)
    for (const id of onDisk) await this.reindex({ workspace, id })
    this.dropRowsWithoutFiles(workspace, onDisk)
  }

  /** Drop the index rows of files that are no longer there, without reading any file. */
  async pruneMissing(workspace: TrainingWorkspace): Promise<void> {
    this.dropRowsWithoutFiles(workspace, await this.baseNamesOnDisk(workspace))
  }

  private dropRowsWithoutFiles(workspace: TrainingWorkspace, onDisk: readonly string[]): void {
    const present = new Set(onDisk)
    for (const id of listTrainingIds(this.db, workspace)) {
      if (!present.has(id)) deleteTrainingRow(this.db, workspace, id)
    }
  }

  private async baseNamesOnDisk(workspace: TrainingWorkspace): Promise<string[]> {
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

export function toTrainingFile(ref: TrainingRef, note: NoteContent): TrainingFile {
  const { head, body } = splitNote(note.content)
  const { meta, problems } = parseTrainingMeta(head)
  return { ref, note, meta, body, problems }
}
