import { readFile, rename } from 'fs/promises'
import { writeFileAtomic } from '../../../main/atomic-write'
import {
  addPerson,
  archivePerson,
  mergePerson,
  normalisePeople,
  removePerson,
  restorePerson,
  updatePerson,
  type NewPerson,
  type PersonPatch
} from '../shared/people'
import type { Person } from '../shared/types'

/**
 * The people list, kept as `data/people.json`. Small enough to hold in memory; every change is
 * written atomically. An unreadable file is set aside (never overwritten), as with settings.
 */
export class PeopleStore {
  private people: Person[] = []

  constructor(private readonly file: string) {}

  list(): Person[] {
    return this.people.map((p) => ({ ...p }))
  }

  async load(): Promise<Person[]> {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.list()
      throw error
    }
    try {
      this.people = normalisePeople(JSON.parse(text))
    } catch {
      await rename(this.file, `${this.file}.corrupt-${Date.now()}`)
      this.people = []
    }
    return this.list()
  }

  async add(input: NewPerson): Promise<Person[]> {
    return this.commit(addPerson(this.people, input))
  }

  async update(name: string, patch: PersonPatch): Promise<Person[]> {
    return this.commit(updatePerson(this.people, name, patch))
  }

  async remove(name: string): Promise<Person[]> {
    return this.commit(removePerson(this.people, name))
  }

  async archive(name: string): Promise<Person[]> {
    return this.commit(archivePerson(this.people, name))
  }

  async restore(name: string): Promise<Person[]> {
    return this.commit(restorePerson(this.people, name))
  }

  /** Remove `from`; `into` takes their place. Editing the notes is the caller's job. */
  async merge(from: string, into: string): Promise<Person[]> {
    return this.commit(mergePerson(this.people, from, into))
  }

  private async commit(next: Person[]): Promise<Person[]> {
    await writeFileAtomic(this.file, JSON.stringify({ people: next }, null, 2) + '\n')
    this.people = next
    return this.list()
  }
}
