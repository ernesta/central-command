import {
  EntrySession,
  type EntrySessionApi,
  type EntrySessionOptions,
  type EntrySnapshot
} from '@renderer/notes/entry-session'
import type { TrainingChangedEvent, TrainingFile, TrainingSaveResult } from '../shared/api'
import { parseTrainingMeta, splitNote, type TrainingChanges } from '../shared/front-matter'
import type { TrainingMeta, TrainingRef } from '../shared/types'
import { isUntouchedTraining } from '../shared/untouched'

/** The slice of the Training API an entry session needs. */
export interface TrainingSessionApi extends EntrySessionApi<TrainingRef, TrainingMeta> {
  read(ref: TrainingRef): Promise<TrainingFile>
  discardIfUntouched(ref: TrainingRef): Promise<boolean>
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
  points: null,
  task: '',
  selfStudy: ''
}

/**
 * One training entry being edited: its fields and its note together, saved as one file (see
 * `EntrySession` for the rules that protect the user's writing).
 */
export class TrainingSession extends EntrySession<TrainingRef, TrainingMeta> {
  constructor(
    ref: TrainingRef,
    private readonly training: TrainingSessionApi,
    options: EntrySessionOptions = {}
  ) {
    super(
      ref,
      training,
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

  protected override isUntouched(meta: TrainingMeta, body: string): boolean {
    return isUntouchedTraining(meta, body)
  }

  protected override discardFile(): Promise<boolean> {
    return this.training.discardIfUntouched(this.getRef())
  }
}
