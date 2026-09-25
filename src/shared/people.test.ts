import { describe, expect, it } from 'vitest'
import {
  PeopleError,
  addPerson,
  deriveInitials,
  findByInitials,
  makeInitialsUnique,
  normalisePeople,
  ownerOptions,
  removePerson,
  updatePerson
} from './people'
import type { Person } from './people'

const p = (name: string, initials: string, me = false): Person => ({ name, initials, me })

describe('deriveInitials', () => {
  it('uses the first letters of the first and last words', () => {
    expect(deriveInitials('Kathy Rastle')).toBe('KR')
    expect(deriveInitials('Ernesta Orlovaitė')).toBe('EO')
    expect(deriveInitials('Jan van der Berg')).toBe('JB')
  })
  it('ignores titles', () => {
    expect(deriveInitials('Prof Kathy Rastle')).toBe('KR')
    expect(deriveInitials('Dr. Arnaud Chevalier')).toBe('AC')
    expect(deriveInitials('Professor Matthew Jukes')).toBe('MJ')
  })
  it('handles one word, accents and odd spacing', () => {
    expect(deriveInitials('Cher')).toBe('C')
    expect(deriveInitials('  élodie   Àvila ')).toBe('ÉÀ')
    expect(deriveInitials('')).toBe('')
    expect(deriveInitials('Dr')).toBe('')
  })
})

describe('makeInitialsUnique', () => {
  it('keeps a free value and numbers a clash, ignoring case', () => {
    expect(makeInitialsUnique('KR', ['AC'])).toBe('KR')
    expect(makeInitialsUnique('KR', ['kr'])).toBe('KR2')
    expect(makeInitialsUnique('KR', ['KR', 'KR2'])).toBe('KR3')
  })
})

describe('addPerson', () => {
  it('derives initials and returns a new list', () => {
    const before: Person[] = []
    const after = addPerson(before, { name: 'Kathy Rastle' })
    expect(after).toEqual([p('Kathy Rastle', 'KR')])
    expect(before).toEqual([])
  })
  it('makes derived initials unique instead of refusing', () => {
    const list = addPerson([p('Kathy Rastle', 'KR')], { name: 'Karl Rowe' })
    expect(list.map((x) => x.initials)).toEqual(['KR', 'KR2'])
  })
  it('refuses explicit initials that clash, and invalid ones', () => {
    const list = [p('Kathy Rastle', 'KR')]
    expect(() => addPerson(list, { name: 'Karl Rowe', initials: 'kr' })).toThrow(PeopleError)
    expect(() => addPerson(list, { name: 'Karl Rowe', initials: 'K R' })).toThrow('not valid')
    expect(() => addPerson(list, { name: 'Karl Rowe', initials: 'ABCDEFG' })).toThrow('not valid')
  })
  it('refuses a blank name and a duplicate name', () => {
    expect(() => addPerson([], { name: '   ' })).toThrow('needs a name')
    expect(() => addPerson([p('Kathy Rastle', 'KR')], { name: 'kathy  rastle' })).toThrow('already')
  })
  it('lets only one person be "me"', () => {
    const list = addPerson([p('Ernesta Orlovaitė', 'EO', true)], { name: 'Kathy Rastle', me: true })
    expect(list.filter((x) => x.me).map((x) => x.name)).toEqual(['Kathy Rastle'])
  })
})

describe('updatePerson', () => {
  const base = [p('Kathy Rastle', 'KR'), p('Arnaud Chevalier', 'AC', true)]
  it('changes initials while keeping them unique', () => {
    expect(updatePerson(base, 'Kathy Rastle', { initials: 'kathy' })[0].initials).toBe('KATHY')
    expect(() => updatePerson(base, 'Kathy Rastle', { initials: 'ac' })).toThrow(
      'already used by Arnaud'
    )
  })
  it('allows keeping one’s own initials and renaming', () => {
    const list = updatePerson(base, 'Kathy Rastle', { initials: 'KR', name: 'Katherine Rastle' })
    expect(list[0]).toEqual(p('Katherine Rastle', 'KR'))
    expect(() => updatePerson(base, 'Kathy Rastle', { name: 'arnaud chevalier' })).toThrow(
      'already'
    )
  })
  it('moves "me" and refuses unknown people', () => {
    expect(updatePerson(base, 'Kathy Rastle', { me: true }).map((x) => x.me)).toEqual([true, false])
    expect(() => updatePerson(base, 'Nobody', {})).toThrow('not in the list')
  })
  it('does not modify its input', () => {
    const copy = JSON.parse(JSON.stringify(base))
    updatePerson(base, 'Kathy Rastle', { initials: 'ZZ', me: true })
    expect(base).toEqual(copy)
  })
})

describe('normalisePeople', () => {
  it('accepts a good file', () => {
    const list = [p('Kathy Rastle', 'KR'), p('Ernesta Orlovaitė', 'EO', true)]
    expect(normalisePeople({ people: list })).toEqual(list)
  })
  it('never drops someone over clashing initials; it renumbers them', () => {
    const out = normalisePeople({
      people: [
        { name: 'A B', initials: 'AB' },
        { name: 'Anna Bell', initials: 'ab' }
      ]
    })
    expect(out.map((x) => x.initials)).toEqual(['AB', 'AB2'])
  })
  it('derives missing initials, skips junk and keeps only the first "me"', () => {
    const out = normalisePeople({
      people: [
        { name: 'Kathy Rastle', me: true },
        7,
        null,
        { nope: 1 },
        { name: 'Arnaud Chevalier', me: true }
      ]
    })
    expect(out).toEqual([p('Kathy Rastle', 'KR', true), p('Arnaud Chevalier', 'AC')])
  })
  it('keeps one entry when the same name appears twice', () => {
    const out = normalisePeople({
      people: [
        { name: 'Kathy Rastle', initials: 'KR' },
        { name: 'kathy rastle', initials: 'KX' }
      ]
    })
    expect(out).toEqual([p('Kathy Rastle', 'KR')])
  })
  it('gives an empty list for anything else', () => {
    expect(normalisePeople(null)).toEqual([])
    expect(normalisePeople('x')).toEqual([])
    expect(normalisePeople({ people: 'x' })).toEqual([])
  })
})

describe('findByInitials', () => {
  it('ignores case and whitespace', () => {
    expect(findByInitials([p('Kathy Rastle', 'KR')], ' kr ')?.name).toBe('Kathy Rastle')
    expect(findByInitials([p('Kathy Rastle', 'KR')], 'AC')).toBeUndefined()
  })
})

describe('ownerOptions', () => {
  const all = [
    p('Kathy Rastle', 'KR'),
    p('Arnaud Chevalier', 'AC'),
    p('Ernesta Orlovaitė', 'EO', true),
    p('Matthew Jukes', 'MJ')
  ]
  it('lists attendees first, in meeting order, then everyone else', () => {
    expect(
      ownerOptions(['Ernesta Orlovaitė', 'Kathy Rastle'], all).map((o) => [o.initials, o.attendee])
    ).toEqual([
      ['EO', true],
      ['KR', true],
      ['AC', false],
      ['MJ', false]
    ])
  })
  it('skips attendees who are not in the people list and lists nobody twice', () => {
    expect(
      ownerOptions(['Stranger', 'Kathy Rastle', 'kathy rastle'], all).map((o) => o.initials)
    ).toEqual(['KR', 'AC', 'EO', 'MJ'])
  })
  it('is empty when nobody is known', () => expect(ownerOptions(['A B'], [])).toEqual([]))
})

describe('removePerson', () => {
  const list = [p('Kathy Rastle', 'KR'), p('Ernesta Orlovaitė', 'EO', true)]
  it('removes only that person, without changing the input', () => {
    const copy = JSON.parse(JSON.stringify(list))
    expect(removePerson(list, ' kathy rastle ')).toEqual([p('Ernesta Orlovaitė', 'EO', true)])
    expect(list).toEqual(copy)
  })
  it('refuses someone who is not in the list', () => {
    expect(() => removePerson(list, 'Nobody')).toThrow('not in the list')
  })
  it('frees the initials for someone else', () => {
    expect(addPerson(removePerson(list, 'Kathy Rastle'), { name: 'Karl Rowe' })[1].initials).toBe(
      'KR'
    )
  })
})
