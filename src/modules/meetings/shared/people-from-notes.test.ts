import { describe, expect, it } from 'vitest'
import type { Person } from '@shared/people'
import { addNamedPeople, namedInNotes } from './people-from-notes'

const people: Person[] = [
  { name: 'Ernesta Orlovaitė', initials: 'EO', me: true },
  { name: 'Ryan McKay', initials: 'RM', me: false }
]

describe('namedInNotes', () => {
  it('lists who is not in the list yet, counting notes once per person', () => {
    const named = namedInNotes(
      people,
      [['Ernesta Orlovaitė', 'Kathy Rastle', 'kathy  rastle'], ['Kathy Rastle'], []],
      [['Kathy Rastle', 'Robyn Muir'], ['ryan mckay']]
    )
    expect(named).toEqual([
      { name: 'Kathy Rastle', meetings: 2, trainings: 1 },
      { name: 'Robyn Muir', meetings: 0, trainings: 1 }
    ])
  })

  it('finds nobody when everyone is in the list', () => {
    expect(namedInNotes(people, [['Ryan McKay']], [])).toEqual([])
  })
})

describe('addNamedPeople', () => {
  it('adds them with unique initials and leaves the list alone', () => {
    const named = [
      { name: 'Robyn Muir', meetings: 0, trainings: 1 },
      { name: 'Rob Moon', meetings: 1, trainings: 0 }
    ]
    const list = addNamedPeople(people, named)
    expect(list.map((p) => p.initials)).toEqual(['EO', 'RM', 'RM2', 'RM3'])
    expect(people).toHaveLength(2)
  })
})
