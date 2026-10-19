import { describe, expect, it } from 'vitest'
import type { Reading } from '../shared/types'
import { isAuthor, readingHits } from './search'
import { plainRequest, searchRequest } from '@shared/search-query'

const reading = (over: Partial<Reading>): Reading =>
  ({
    citekey: 'kimImpact2020',
    shortCitation: 'Kim et al. (2020)',
    fullTitle: 'Impact of Literacy Interventions',
    notesExcerpt: '',
    authors: [],
    tags: [],
    status: 'unset',
    hasNotes: false,
    year: null,
    ...over
  }) as Reading

describe('readingHits', () => {
  it('describes a reading by its short citation and goes to its page', () => {
    expect(readingHits([reading({})], plainRequest('literacy'))).toEqual([
      {
        key: 'kimImpact2020',
        title: 'Impact of Literacy Interventions',
        detail: 'Kim et al. (2020)',
        route: '/research/readings/kimImpact2020'
      }
    ])
  })

  it('shows the part of the notes that matched when the title does not', () => {
    const [hit] = readingHits(
      [reading({ notesExcerpt: 'Effect sizes were larger for phonics.' })],
      plainRequest('phonics')
    )
    expect(hit.detail).toContain('phonics')
  })
})

describe('isAuthor', () => {
  it('matches the full name, or the family name with the given initial', () => {
    expect(isAuthor({ family: 'Rastle', given: 'Kathy' }, 'kathy rastle')).toBe(true)
    expect(isAuthor({ family: 'Rastle', given: 'K.' }, 'kathy rastle')).toBe(true)
    expect(isAuthor({ family: 'Rastle', given: 'Jane' }, 'kathy rastle')).toBe(false)
    expect(isAuthor({ family: 'Rastle' }, 'kathy rastle')).toBe(false)
    expect(isAuthor({ literal: 'OECD' }, 'oecd')).toBe(true)
    expect(isAuthor({ family: 'Müller', given: 'Zoë' }, 'zoe muller')).toBe(true)
  })
})

describe('readingHits with modifiers', () => {
  const today = '2026-10-19'
  const rows = [
    reading({
      citekey: 'a',
      fullTitle: 'Phonics',
      authors: [{ family: 'Rastle', given: 'Kathy' }],
      status: 'read',
      tags: ['Stats'],
      hasNotes: true,
      year: 2020
    }),
    reading({
      citekey: 'b',
      fullTitle: 'Morphology',
      authors: [{ family: 'Kim', given: 'Sam' }],
      status: 'to_read',
      tags: [],
      hasNotes: false,
      year: 2026
    }),
    reading({ citekey: 'c', fullTitle: 'No year', status: 'unset', year: null })
  ]
  const run = (query: string): string[] =>
    readingHits(rows, searchRequest(query, today), 40).map((h) => h.key)

  it('with: and by: are the authors', () => {
    expect(run('with:"kathy rastle"')).toEqual(['a'])
    expect(run('by:"sam kim"')).toEqual(['b'])
    expect(run('-by:"sam kim"').sort()).toEqual(['a', 'c'])
  })

  it('status: read and "to read"; an unset reading is neither', () => {
    expect(run('status:read')).toEqual(['a'])
    expect(run('status:"to read"')).toEqual(['b'])
    expect(run('-status:read').sort()).toEqual(['b', 'c'])
  })

  it('tag: and has:notes', () => {
    expect(run('tag:stats')).toEqual(['a'])
    expect(run('-tag:stats').sort()).toEqual(['b', 'c'])
    expect(run('has:notes')).toEqual(['a'])
    expect(run('-has:notes').sort()).toEqual(['b', 'c'])
  })

  it('dates are the year only; a reading with no year matches none', () => {
    expect(run('before:2025')).toEqual(['a'])
    expect(run('after:2020')).toEqual(['b'])
    expect(run('on:2026')).toEqual(['b'])
    expect(run('during:"this year"')).toEqual(['b'])
    expect(run('during:2026-05')).toEqual([])
    expect(run('-on:2026').sort()).toEqual(['a', 'c'])
  })

  it('finds a quoted phrase in the title, authors, tags or notes', () => {
    expect(run('"no year"')).toEqual(['c'])
    expect(run('"year no"')).toEqual([])
  })
})
