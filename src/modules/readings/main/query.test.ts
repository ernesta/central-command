import { describe, expect, it } from 'vitest'
import { DEFAULT_READINGS_QUERY, type ReadingsQuery } from '../shared/query'
import type { Reading } from '../shared/types'
import { collectTags, fold, queryReadings } from './query'

let nextId = 1
function reading(overrides: Partial<Reading> & { citekey: string }): Reading {
  return {
    id: nextId++,
    shortCitation: `${overrides.citekey} (2020)`,
    fullTitle: `Title ${overrides.citekey}`,
    authors: [],
    year: 2020,
    status: 'unset',
    tags: [],
    abstract: null,
    entryType: 'article',
    reference: null,
    missingFromSource: false,
    hasNotes: false,
    notesExcerpt: '',
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

const q = (overrides: Partial<ReadingsQuery> = {}): ReadingsQuery => ({
  ...DEFAULT_READINGS_QUERY,
  ...overrides
})
const keys = (rs: Reading[]): string[] => rs.map((r) => r.citekey)

describe('fold', () => {
  it('lowercases and strips accents', () => {
    expect(fold('Müller')).toBe('muller')
    expect(fold('Łukasz Ørsted')).toBe('lukasz orsted')
    expect(fold('CAFÉ')).toBe('cafe')
  })
})

describe('queryReadings: search', () => {
  const data = [
    reading({ citekey: 'a', shortCitation: 'Müller (2015)', fullTitle: 'Reading in Zürich' }),
    reading({
      citekey: 'b',
      shortCitation: 'Smith (2020)',
      fullTitle: 'Econometrics',
      tags: ['Policy', 'africa']
    }),
    reading({
      citekey: 'c',
      shortCitation: 'Lee (2021)',
      fullTitle: 'Other',
      notesExcerpt: 'Remember the instrument variable'
    })
  ]

  it('returns everything for an empty or blank search', () => {
    expect(queryReadings(data, q({ search: '' }))).toHaveLength(3)
    expect(queryReadings(data, q({ search: '   ' }))).toHaveLength(3)
  })
  it('matches short citation, title, tags and notes excerpt', () => {
    expect(keys(queryReadings(data, q({ search: 'smith' })))).toEqual(['b'])
    expect(keys(queryReadings(data, q({ search: 'zurich' })))).toEqual(['a'])
    expect(keys(queryReadings(data, q({ search: 'africa' })))).toEqual(['b'])
    expect(keys(queryReadings(data, q({ search: 'instrument' })))).toEqual(['c'])
  })
  it('is accent- and case-insensitive in both directions', () => {
    expect(keys(queryReadings(data, q({ search: 'MULLER' })))).toEqual(['a'])
    expect(keys(queryReadings(data, q({ search: 'zürich' })))).toEqual(['a'])
  })
  it('requires every term, in any field', () => {
    expect(keys(queryReadings(data, q({ search: 'smith policy' })))).toEqual(['b'])
    expect(queryReadings(data, q({ search: 'smith zurich' }))).toEqual([])
  })
  it('does not treat search text as a pattern', () => {
    expect(queryReadings(data, q({ search: '%' }))).toEqual([])
    expect(queryReadings(data, q({ search: '(2020)' })).map((r) => r.citekey)).toEqual(['b'])
  })
})

describe('queryReadings: filters', () => {
  const data = [
    reading({ citekey: 'r', status: 'read', tags: ['x', 'y'] }),
    reading({ citekey: 't', status: 'to_read', tags: ['x'] }),
    reading({ citekey: 'u', status: 'unset', tags: ['Y'] }),
    reading({ citekey: 'm', status: 'to_read', missingFromSource: true })
  ]
  const sorted = (query: Partial<ReadingsQuery>): string[] =>
    keys(queryReadings(data, q({ sort: { key: 'citation', direction: 'asc' }, ...query })))

  it('filters by status', () => {
    expect(sorted({ status: 'to_read' })).toEqual(['m', 't'])
    expect(sorted({ status: 'read' })).toEqual(['r'])
    expect(sorted({ status: 'unset' })).toEqual(['u'])
    expect(sorted({ status: 'all' })).toHaveLength(4)
  })
  it('requires all selected tags, ignoring case', () => {
    expect(sorted({ tags: ['x'] })).toEqual(['r', 't'])
    expect(sorted({ tags: ['x', 'y'] })).toEqual(['r'])
    expect(sorted({ tags: ['y'] })).toEqual(['r', 'u'])
    expect(sorted({ tags: ['nope'] })).toEqual([])
  })
  it('can show only readings missing from Zotero', () => {
    expect(sorted({ missingOnly: true })).toEqual(['m'])
  })
  it('combines filters', () => {
    expect(sorted({ status: 'to_read', tags: ['x'] })).toEqual(['t'])
    expect(sorted({ status: 'to_read', missingOnly: true })).toEqual(['m'])
  })
})

describe('queryReadings: sorting', () => {
  const data = [
    reading({
      citekey: 'a',
      shortCitation: 'Zed (2010)',
      fullTitle: 'beta',
      year: 2010,
      status: 'read',
      addedAt: '2026-01-03',
      updatedAt: '2026-02-01'
    }),
    reading({
      citekey: 'b',
      shortCitation: 'Ålund (2022)',
      fullTitle: 'Alpha',
      year: 2022,
      status: 'to_read',
      addedAt: '2026-01-01',
      updatedAt: '2026-03-01'
    }),
    reading({
      citekey: 'c',
      shortCitation: 'Mia (n.d.)',
      fullTitle: 'Gamma',
      year: null,
      status: 'unset',
      addedAt: '2026-01-02',
      updatedAt: '2026-01-01'
    }),
    reading({
      citekey: 'd',
      shortCitation: 'Kim (2016)',
      fullTitle: 'delta',
      year: 2016,
      status: 'to_read',
      addedAt: '2026-01-04',
      updatedAt: '2026-01-15'
    })
  ]
  const order = (key: ReadingsQuery['sort']['key'], direction: 'asc' | 'desc'): string[] =>
    keys(queryReadings(data, q({ sort: { key, direction } })))

  it('sorts by year both ways with missing years always last', () => {
    expect(order('year', 'desc')).toEqual(['b', 'd', 'a', 'c'])
    expect(order('year', 'asc')).toEqual(['a', 'd', 'b', 'c'])
  })
  it('sorts by citation with accents ordered naturally (Å with A)', () => {
    expect(order('citation', 'asc')).toEqual(['b', 'd', 'c', 'a'])
    expect(order('citation', 'desc')).toEqual(['a', 'c', 'd', 'b'])
  })
  it('sorts titles ignoring case', () => {
    expect(order('title', 'asc')).toEqual(['b', 'a', 'd', 'c'])
  })
  it('sorts by status: to read, read, unset', () => {
    expect(order('status', 'asc')).toEqual(['b', 'd', 'a', 'c'])
  })
  it('sorts by recently added and recently updated', () => {
    expect(order('added', 'desc')).toEqual(['d', 'a', 'c', 'b'])
    expect(order('updated', 'desc')).toEqual(['b', 'a', 'd', 'c'])
  })
  it('breaks ties by citation then citekey so order is stable', () => {
    const ties = [
      reading({ citekey: 'z2', shortCitation: 'Same (2020)', year: 2020 }),
      reading({ citekey: 'z1', shortCitation: 'Same (2020)', year: 2020 }),
      reading({ citekey: 'a1', shortCitation: 'Aaa (2020)', year: 2020 })
    ]
    expect(keys(queryReadings(ties, q()))).toEqual(['a1', 'z1', 'z2'])
  })
  it('does not mutate its input', () => {
    const copy = [...data]
    queryReadings(data, q())
    expect(data).toEqual(copy)
  })
})

describe('collectTags', () => {
  it('counts readings per tag, merging case variants under the first spelling', () => {
    const tags = collectTags([
      reading({ citekey: 'a', tags: ['Education', 'lmics'] }),
      reading({ citekey: 'b', tags: ['education', 'Africa'] }),
      reading({ citekey: 'c', tags: ['EDUCATION', 'education'] })
    ])
    expect(tags).toEqual([
      { tag: 'Africa', count: 1 },
      { tag: 'Education', count: 3 },
      { tag: 'lmics', count: 1 }
    ])
  })
  it('is empty when nothing is tagged', () => {
    expect(collectTags([reading({ citekey: 'a' })])).toEqual([])
  })
})
