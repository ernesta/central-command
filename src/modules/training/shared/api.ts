import type { NoteContent } from '@shared/notes'
import type { TrainingChanges } from './front-matter'
import type {
  TrainingIndexRow,
  TrainingMeta,
  TrainingMode,
  TrainingRef,
  TrainingWorkspace
} from './types'

export interface CreateTrainingInput {
  workspace: TrainingWorkspace
  /** YYYY-MM-DD. */
  date: string
  title: string
  start?: string | null
  end?: string | null
  series?: string | null
  type?: string | null
  mode?: TrainingMode | null
  skills?: string[]
  leads?: string[]
  /** The note body; a new entry gets the standard template when omitted. */
  body?: string
}

/** An entry file as read from disk, split into its parts. */
export interface TrainingFile {
  ref: TrainingRef
  /** The whole file (front matter and body) and its hash; `baseHash` for the next save. */
  note: NoteContent
  meta: TrainingMeta
  /** The note text after the front matter, exactly as on disk. */
  body: string
  /** What is wrong with the front matter, if anything. */
  problems: string[]
}

/** The result of saving an entry. Changing the date or title renames the file, and says so. */
export type TrainingSaveResult =
  | {
      status: 'saved'
      hash: string
      /** The entry's new id when its file was renamed. */ renamedTo?: string
    }
  /** The file changed since `baseHash`; nothing was written. */
  | { status: 'conflict'; disk: NoteContent }

/** Pushed to the renderer when an entry file changes on disk (from any tool, including this app). */
export interface TrainingChangedEvent {
  ref: TrainingRef
  /** Hash of the whole file now; null when the file was removed. */
  hash: string | null
}

/** The Training slice of window.api. */
export interface TrainingApi {
  /** Create a new entry file and resolve with it. Never replaces an existing file. */
  create(input: CreateTrainingInput): Promise<TrainingFile>
  read(ref: TrainingRef): Promise<TrainingFile>
  /** Every entry in a workspace from the index, newest first. */
  list(workspace: TrainingWorkspace): Promise<TrainingIndexRow[]>
  /**
   * Save changes to the front matter fields and/or the body. `baseHash` is the hash of the file the
   * caller last read or saved; if the file has since changed on disk nothing is written and a
   * conflict is returned.
   */
  save(ref: TrainingRef, changes: TrainingChanges, baseHash: string): Promise<TrainingSaveResult>
  /** Move the entry's file to the Trash. The caller is responsible for asking the user first. */
  delete(ref: TrainingRef): Promise<void>
  /** Subscribe to entry files changing on disk. Returns an unsubscribe function. */
  onChanged(listener: (event: TrainingChangedEvent) => void): () => void
}

export const TRAINING_IPC = {
  create: 'training:create',
  read: 'training:read',
  list: 'training:list',
  save: 'training:save',
  delete: 'training:delete',
  changed: 'training:changed'
} as const
