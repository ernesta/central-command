import { describe, expect, it } from 'vitest'
import type { PersonUsage } from '../shared/people-usage'
import type { Person } from '../shared/types'
import { personHits } from './people-search'

const person = (over: Partial<Person>): Person => ({
  name: 'Kathy Rastle',
  initials: 'KR',
  me: false,
  ...over
})
const usage = (name: string, meetings: number, trainings: number): PersonUsage => ({
  name,
  meetings,
  trainings,
  attended: meetings,
  todos: 0,
  todoMeetings: 0
})

describe('personHits', () => {
  const people = [
    person({ name: 'Kathy Rastle', initials: 'KR' }),
    person({ name: 'Kathryn Redway', initials: 'KR2' }),
    person({ name: 'Ernesta Orlovaitė', initials: 'EO', me: true }),
    person({ name: 'Someone Archived', initials: 'SA', archived: true })
  ]
  const usages = [usage('Kathy Rastle', 14, 0), usage('Kathryn Redway', 1, 0)]

  it('finds by name or initials, folding case and accents', () => {
    expect(personHits(people, usages, 'kathy').map((h) => h.key)).toEqual(['Kathy Rastle'])
    expect(personHits(people, usages, 'KR2').map((h) => h.key)).toEqual(['Kathryn Redway'])
  })

  it('shows how often each is mentioned, and marks the user as "(you)"', () => {
    const [hit] = personHits(people, usages, 'kathy rastle')
    expect(hit.detail).toBe('14 meetings')
    expect(personHits(people, [], 'ernesta')[0].title).toBe('Ernesta Orlovaitė (you)')
  })

  it('says "Not mentioned yet" for someone with no meetings or trainings', () => {
    expect(personHits(people, [], 'ernesta')[0].detail).toBe('Not mentioned yet')
  })

  it('puts the most mentioned first when several match', () => {
    expect(personHits(people, usages, 'kath').map((h) => h.key)).toEqual([
      'Kathy Rastle',
      'Kathryn Redway'
    ])
  })

  it('never matches an archived person', () => {
    expect(personHits(people, [], 'archived')).toEqual([])
  })

  it('routes to that person’s own page', () => {
    expect(personHits(people, usages, 'kathy rastle')[0].route).toBe(
      '/research/meetings/people/Kathy%20Rastle'
    )
  })

  it('shows at most the given limit', () => {
    expect(personHits(people, usages, '', 2)).toHaveLength(2)
  })
})
