import { addPerson, findByName, type Person } from '@shared/people'

export interface NamedInNotes {
  name: string
  meetings: number
  trainings: number
}

/**
 * The people named in meeting attendees and training leads who are not in the list yet, with how many notes
 * name them. Names match the way the list does (ignoring case and spacing); the first spelling found is kept.
 */
export function namedInNotes(
  people: readonly Person[],
  attendeeLists: readonly (readonly string[])[],
  leadLists: readonly (readonly string[])[]
): NamedInNotes[] {
  const found = new Map<string, NamedInNotes>()
  const count = (lists: readonly (readonly string[])[], field: 'meetings' | 'trainings'): void => {
    for (const list of lists) {
      const seen = new Set<string>()
      for (const raw of list) {
        const name = raw.trim().replace(/\s+/g, ' ')
        const key = name.toLowerCase()
        if (!name || findByName(people, name) || seen.has(key)) continue
        seen.add(key)
        const entry = found.get(key) ?? { name, meetings: 0, trainings: 0 }
        entry[field]++
        found.set(key, entry)
      }
    }
  }
  count(attendeeLists, 'meetings')
  count(leadLists, 'trainings')
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** The list with each named person added, initials worked out from the name and made unique (KR, KR2, …). */
export function addNamedPeople(
  people: readonly Person[],
  named: readonly NamedInNotes[]
): Person[] {
  return named.reduce<Person[]>((list, n) => addPerson(list, { name: n.name }), [...people])
}
