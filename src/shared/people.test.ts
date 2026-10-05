import { describe, expect, it } from 'vitest'
import {
  PeopleError,
  activePeople,
  addPerson,
  archivePerson,
  deriveInitials,
  findByInitials,
  findByName,
  isSafeLinkUrl,
  makeInitialsUnique,
  suggestInitials,
  mergePerson,
  normalisePeople,
  matchPeople,
  ownerOptions,
  removePerson,
  restorePerson,
  orderNames,
  sortPeople,
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

describe('hyphenated names and clashes', () => {
  it('gives a hyphenated last name a letter per part', () => {
    expect(deriveInitials('Roger Giner-Sorolla')).toBe('RGS')
  })
  it('prefers the capitals in the last name to a number', () => {
    expect(suggestInitials('Ryan McKay', ['RM'])).toBe('RMK')
  })
  it('then tries more letters of the last name, then a number', () => {
    expect(suggestInitials('Rachel Miller', ['RM'])).toBe('RMI')
    expect(suggestInitials('Al Bo', ['AB', 'ABO'])).toBe('AB2')
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
    expect(list.map((x) => x.initials)).toEqual(['KR', 'KRO'])
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

  it('sets links, replacing the whole list, and leaves them alone when not given', () => {
    const withLinks = updatePerson(base, 'Kathy Rastle', {
      links: [{ label: 'Google Scholar', url: 'https://scholar.google.com/x' }]
    })
    expect(withLinks[0].links).toEqual([
      { label: 'Google Scholar', url: 'https://scholar.google.com/x' }
    ])
    // A later change that says nothing about links keeps them.
    const renamed = updatePerson(withLinks, 'Kathy Rastle', { name: 'Katherine Rastle' })
    expect(renamed[0].links).toEqual(withLinks[0].links)
    // An explicit empty list clears them.
    expect(updatePerson(withLinks, 'Kathy Rastle', { links: [] })[0].links).toEqual([])
  })

  it('refuses a link with no label, or a URL that is not http(s) (a mutation check for the URL guard)', () => {
    expect(() =>
      updatePerson(base, 'Kathy Rastle', { links: [{ label: '', url: 'https://x.com' }] })
    ).toThrow('needs a label')
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'not a url']) {
      expect(() => updatePerson(base, 'Kathy Rastle', { links: [{ label: 'X', url }] })).toThrow(
        'not a web address'
      )
    }
  })
})

describe('isSafeLinkUrl', () => {
  it('accepts only http and https', () => {
    expect(isSafeLinkUrl('https://example.com')).toBe(true)
    expect(isSafeLinkUrl('http://example.com')).toBe(true)
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeLinkUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeLinkUrl('not a url')).toBe(false)
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

  it('reads good links and drops one with no label or an unsafe URL, never crashing on a hand-edited file', () => {
    const out = normalisePeople({
      people: [
        {
          name: 'Kathy Rastle',
          links: [
            { label: 'Google Scholar', url: 'https://scholar.google.com/x' },
            { label: '', url: 'https://dropped.example.com' },
            { label: 'Bad', url: 'javascript:alert(1)' },
            'not an object',
            { label: 'No URL' }
          ]
        }
      ]
    })
    expect(out[0].links).toEqual([{ label: 'Google Scholar', url: 'https://scholar.google.com/x' }])
  })

  it('leaves links out entirely for someone with none', () => {
    expect(normalisePeople({ people: [{ name: 'A B' }] })[0].links).toBeUndefined()
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
  it('lists attendees first, then everyone else, each alphabetical with me first', () => {
    expect(
      ownerOptions(['Kathy Rastle', 'Matthew Jukes', 'Ernesta Orlovaitė'], all).map((o) => [
        o.initials,
        o.attendee
      ])
    ).toEqual([
      ['EO', true],
      ['KR', true],
      ['MJ', true],
      ['AC', false]
    ])
  })
  it('skips attendees who are not in the people list and lists nobody twice', () => {
    expect(
      ownerOptions(['Stranger', 'Kathy Rastle', 'kathy rastle'], all).map((o) => o.initials)
    ).toEqual(['KR', 'EO', 'AC', 'MJ'])
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

describe('archived people', () => {
  const list: Person[] = [
    { name: 'Ernesta Orlovaitė', initials: 'EO', me: true },
    { name: 'Kathy Rastle', initials: 'KR', me: false },
    { name: 'Cilla Harries', initials: 'CH', me: false }
  ]

  it('archives and restores without touching anyone else', () => {
    const archived = archivePerson(list, 'Cilla Harries')
    expect(archived[2]).toEqual({
      name: 'Cilla Harries',
      initials: 'CH',
      me: false,
      archived: true
    })
    expect(archived.slice(0, 2)).toEqual(list.slice(0, 2))
    expect(restorePerson(archived, 'Cilla Harries')).toEqual(list)
    expect(list[2].archived).toBeUndefined()
  })

  it('cannot be "me" once archived', () => {
    expect(archivePerson(list, 'Ernesta Orlovaitė')[0]).toMatchObject({ me: false, archived: true })
  })

  it('still resolves by name and initials, and keeps the initials reserved', () => {
    const archived = archivePerson(list, 'Cilla Harries')
    expect(findByName(archived, 'Cilla Harries')?.initials).toBe('CH')
    expect(findByInitials(archived, 'ch')?.name).toBe('Cilla Harries')
    expect(() => addPerson(archived, { name: 'Chloe Hart', initials: 'CH' })).toThrow(
      /already used/
    )
    expect(addPerson(archived, { name: 'Chloe Hart' }).at(-1)?.initials).toBe('CHA')
  })

  it('stays archived when edited, and is read back from the file', () => {
    const archived = archivePerson(list, 'Cilla Harries')
    expect(updatePerson(archived, 'Cilla Harries', { initials: 'CX' })[2].archived).toBe(true)
    expect(normalisePeople({ people: archived })[2].archived).toBe(true)
    expect(normalisePeople({ people: list })[2]).toEqual(list[2])
  })

  it('is not offered as an owner, unless they attended', () => {
    const archived = archivePerson(list, 'Cilla Harries')
    expect(ownerOptions([], archived).map((o) => o.initials)).toEqual(['EO', 'KR'])
    expect(ownerOptions(['Cilla Harries'], archived).map((o) => o.initials)).toEqual([
      'CH',
      'EO',
      'KR'
    ])
    expect(activePeople(archived).map((p) => p.name)).toEqual(['Ernesta Orlovaitė', 'Kathy Rastle'])
  })
})

describe('mergePerson', () => {
  const list: Person[] = [
    { name: 'Ernesta Orlovaitė', initials: 'EO', me: true },
    { name: 'Kathy Rastle', initials: 'KR', me: false },
    { name: 'Kathryn Rastle', initials: 'KRa', me: false }
  ]

  it('removes the merged person and leaves the rest', () => {
    expect(mergePerson(list, 'Kathryn Rastle', 'Kathy Rastle')).toEqual(list.slice(0, 2))
  })

  it('hands over "me"', () => {
    const merged = mergePerson(list, 'Ernesta Orlovaitė', 'Kathy Rastle')
    expect(merged.find((p) => p.me)?.name).toBe('Kathy Rastle')
  })

  it('refuses itself, unknown people and archived targets', () => {
    expect(() => mergePerson(list, 'Kathy Rastle', 'Kathy Rastle')).toThrow(/someone else/)
    expect(() => mergePerson(list, 'Nobody', 'Kathy Rastle')).toThrow(/not in the list/)
    expect(() => mergePerson(list, 'Kathy Rastle', 'Nobody')).toThrow(/not in the list/)
    const archived = archivePerson(list, 'Kathryn Rastle')
    expect(() => mergePerson(archived, 'Kathy Rastle', 'Kathryn Rastle')).toThrow(/archived/)
  })
})

describe('sortPeople', () => {
  it('puts you first, then everyone alphabetically', () => {
    const list: Person[] = [
      { name: 'Zoe Adams', initials: 'ZA', me: false },
      { name: 'Ernesta Orlovaitė', initials: 'EO', me: true },
      { name: 'Anat Bardi', initials: 'AB', me: false }
    ]
    expect(sortPeople(list).map((p) => p.name)).toEqual([
      'Ernesta Orlovaitė',
      'Anat Bardi',
      'Zoe Adams'
    ])
    expect(list[0].name).toBe('Zoe Adams')
  })
})

describe('orderNames', () => {
  it('puts you first however the names were added, others alphabetically', () => {
    const list: Person[] = [
      { name: 'Zoe Adams', initials: 'ZA', me: false },
      { name: 'Ernesta Orlovaitė', initials: 'EO', me: true },
      { name: 'Anat Bardi', initials: 'AB', me: false }
    ]
    expect(
      orderNames(list, ['Zoe Adams', 'Unknown One', 'Ernesta Orlovaitė', 'Anat Bardi'])
    ).toEqual(['Ernesta Orlovaitė', 'Anat Bardi', 'Unknown One', 'Zoe Adams'])
  })
})

describe('sortPeople and matchPeople', () => {
  const all = [p('Zed Last', 'ZL'), p('Ernesta Orlovaitė', 'EO', true), p('Ann Alpha', 'AA')]
  it('puts me first, then alphabetical, without changing the input', () => {
    expect(sortPeople(all).map((x) => x.initials)).toEqual(['EO', 'AA', 'ZL'])
    expect(all[0].initials).toBe('ZL')
  })
  it('matches every word in the name or initials, ignoring accents and case', () => {
    expect(matchPeople(all, 'orlov').map((x) => x.initials)).toEqual(['EO'])
    expect(matchPeople(all, 'ernesta orlovaite').map((x) => x.initials)).toEqual(['EO'])
    expect(matchPeople(all, 'zl').map((x) => x.initials)).toEqual(['ZL'])
    expect(matchPeople(all, '')).toHaveLength(3)
  })
})
