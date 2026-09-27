import { fold } from '@shared/text'
import { searchTerms, type SearchHit } from '@shared/search'
import type { PersonUsage } from '../shared/people-usage'
import type { Person } from '../shared/types'
import { personRoute } from './meetings-paths'

const DEFAULT_LIMIT = 6

function usageLine(usage: PersonUsage | undefined): string {
  const meetings = usage?.meetings ?? 0
  const trainings = usage?.trainings ?? 0
  if (meetings === 0 && trainings === 0) return 'Not mentioned yet'
  const parts: string[] = []
  if (meetings > 0) parts.push(`${meetings} meeting${meetings === 1 ? '' : 's'}`)
  if (trainings > 0) parts.push(`${trainings} training${trainings === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

/**
 * The people whose name or initials match, most mentioned first (a rough stand-in for relevance, since there is
 * nothing to search inside): archived people are left out, as they are from every other picker in the app.
 * Opens the People page with this one to jump to.
 */
export function personHits(
  people: readonly Person[],
  usage: readonly PersonUsage[],
  query: string,
  limit = DEFAULT_LIMIT
): SearchHit[] {
  const terms = searchTerms(query)
  const usageFor = (name: string): PersonUsage | undefined => usage.find((u) => u.name === name)
  return people
    .filter((p) => !p.archived)
    .filter((p) => terms.every((t) => fold(`${p.name} ${p.initials}`).includes(t)))
    .sort((a, b) => {
      const total = (u: PersonUsage | undefined): number => (u?.meetings ?? 0) + (u?.trainings ?? 0)
      return total(usageFor(b.name)) - total(usageFor(a.name)) || a.name.localeCompare(b.name)
    })
    .slice(0, limit)
    .map((person) => ({
      key: person.name,
      title: person.me ? `${person.name} (you)` : person.name,
      detail: usageLine(usageFor(person.name)),
      route: personRoute(person.name)
    }))
}

export async function searchPeople(query: string, limit?: number): Promise<SearchHit[]> {
  const [people, usage] = await Promise.all([
    window.api.meetings.people.list(),
    window.api.meetings.people.usage()
  ])
  return personHits(people, usage, query, limit)
}
