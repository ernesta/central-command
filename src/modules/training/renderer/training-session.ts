import {
  EntrySession,
  type EntrySessionApi,
  type EntrySessionOptions,
  type EntrySnapshot
} from '@renderer/notes/entry-session'
import type { TrainingChangedEvent, TrainingFile, TrainingSaveResult } from '../shared/api'
import { parseTrainingMeta, splitNote, type TrainingChanges } from '../shared/front-matter'
import type { TrainingMeta, TrainingRef } from '../shared/types'

/** The slice of the Training API an entry session needs. */
export interface TrainingSessionApi extends EntrySessionApi<TrainingRef, TrainingMeta> {
  read(ref: TrainingRef): Promise<TrainingFile>
  save(ref: TrainingRef, changes: TrainingChanges, baseHash: string): Promise<TrainingSaveResult>
  onChanged(listener: (event: TrainingChangedEvent) => void): () => void
}

export type TrainingSnapshot = EntrySnapshot<TrainingMeta>

export const EMPTY_TRAINING_META: TrainingMeta = {
  date: '',
  start: null,
  end: null,
  title: '',
  series: null,
  type: null,
  mode: null,
  skills: [],
  leads: [],
  institution: null,
  folder: null,
  organisation: null,
  points: null
}

/**
 * One training entry being edited: its fields and its note together, saved as one file (see
 * `EntrySession` for the rules that protect the user's writing).
 */
export class TrainingSession extends EntrySession<TrainingRef, TrainingMeta> {
  constructor(ref: TrainingRef, api: TrainingSessionApi, options: EntrySessionOptions = {}) {
    super(
      ref,
      api,
      {
        emptyMeta: EMPTY_TRAINING_META,
        parseDisk: (note) => {
          const { head, body } = splitNote(note.content)
          return { meta: parseTrainingMeta(head).meta, body }
        },
        missingPattern: /Training entry not found/,
        noun: 'training entry'
      },
      options
    )
  }
}
