import { join } from 'path'
import { findByName, PeopleError, type Person } from '@shared/people'
import {
  isNoChange,
  personChange,
  type PersonChange,
  type RewriteReport
} from '@shared/people-rewrite'
import { rewriteNoteFiles } from '../../../main/notes/rewrite-files'
import { rewriteTrainingPeople } from '../../training/shared/people-rewrite'
import type { PeopleResult, RemoveHow } from '../shared/api'
import { rewriteMeetingPeople } from '../shared/people-rewrite'
import type { PersonPatch } from '../shared/people'
import { personUsage, type PersonUsage } from '../shared/people-usage'
import type { PeopleStore } from './people-store'

interface PeopleServiceOptions {
  store: PeopleStore
  /** The folders holding meeting notes and training entries. */
  meetingsDir: string
  trainingDir: string
  /** Where a change keeps copies of the notes it edits; a new folder for every change. */
  backupsDir: string
  /** The indexed notes, for counting who is mentioned where. */
  indexed: () => {
    meetings: Parameters<typeof personUsage>[1]
    trainings: Parameters<typeof personUsage>[2]
  }
  /** Bring the index up to date for a note this service just rewrote, so counts are right straight away. */
  reindex: (kind: 'meetings' | 'training', fileName: string) => Promise<void>
  now?: () => Date
}

const NOTHING: RewriteReport = { changed: 0, skipped: [] }

/**
 * The people list together with the notes that mention people. Changing a name or initials, or merging
 * two people, is written into the note files (see `rewriteMeetingPeople`); archiving and deleting never
 * edit a note.
 */
export class PeopleService {
  constructor(private readonly options: PeopleServiceOptions) {}

  usage(): PersonUsage[] {
    const { meetings, trainings } = this.options.indexed()
    return personUsage(this.options.store.list(), meetings, trainings)
  }

  async update(name: string, patch: PersonPatch): Promise<PeopleResult> {
    const { store } = this.options
    const before = store.list()
    const index = before.findIndex((p) => p === findByName(before, name))
    const people = await store.update(name, patch)
    const report =
      index === -1 ? NOTHING : await this.rewrite(personChange(before[index], people[index]))
    return { people, report }
  }

  async remove(name: string, how: RemoveHow): Promise<PeopleResult> {
    const { store } = this.options
    const person = findByName(store.list(), name)
    if (!person) throw new PeopleError(`${name} is not in the list`)
    if (how.how === 'archive') return { people: await store.archive(name), report: NOTHING }
    if (how.how === 'merge') {
      const target = findByName(store.list(), how.into)
      if (!target) throw new PeopleError(`${how.into} is not in the list`)
      const people = await store.merge(name, how.into)
      return { people, report: await this.rewrite(personChange(person, target)) }
    }
    const used = this.usage().find((u) => u.name === person.name)
    if (used && used.meetings + used.trainings > 0) {
      throw new PeopleError(`${person.name} is mentioned in notes; archive or merge instead`)
    }
    return { people: await store.remove(name), report: NOTHING }
  }

  restore(name: string): Promise<Person[]> {
    return this.options.store.restore(name)
  }

  private async rewrite(change: PersonChange): Promise<RewriteReport> {
    if (isNoChange(change)) return NOTHING
    const { meetingsDir, trainingDir, backupsDir, now = () => new Date() } = this.options
    const backup = join(backupsDir, `people-${now().toISOString().replace(/[:.]/g, '-')}`)
    const meetings = await rewriteNoteFiles({
      dir: meetingsDir,
      backupDir: join(backup, 'meetings'),
      transform: (content) => rewriteMeetingPeople(content, change)
    })
    const trainings = await rewriteNoteFiles({
      dir: trainingDir,
      backupDir: join(backup, 'training'),
      transform: (content) => rewriteTrainingPeople(content, change)
    })
    for (const name of meetings.changed) await this.options.reindex('meetings', name)
    for (const name of trainings.changed) await this.options.reindex('training', name)
    return {
      changed: meetings.changed.length + trainings.changed.length,
      skipped: [...meetings.skipped, ...trainings.skipped]
    }
  }
}
