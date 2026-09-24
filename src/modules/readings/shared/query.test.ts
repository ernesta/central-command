import { describe, expect, it } from 'vitest'
import {
  DEFAULT_READINGS_QUERY,
  DEFAULT_VIEW_PREFS,
  normaliseQuery,
  normaliseViewPrefs
} from './query'

describe('normaliseQuery', () => {
  it('returns defaults for junk', () => {
    for (const junk of [undefined, null, 5, 'x', [], {}]) {
      expect(normaliseQuery(junk)).toEqual(DEFAULT_READINGS_QUERY)
    }
  })
  it('keeps valid values', () => {
    const valid = {
      search: 'reading',
      status: 'to_read',
      tags: ['a', 'b'],
      sort: { key: 'title', direction: 'asc' },
      missingOnly: true
    }
    expect(normaliseQuery(valid)).toEqual(valid)
  })
  it('replaces invalid fields one by one', () => {
    expect(
      normaliseQuery({
        search: 3,
        status: 'maybe',
        tags: ['ok', 7, null],
        sort: { key: 'nope', direction: 'asc' },
        missingOnly: 'yes'
      })
    ).toEqual({ ...DEFAULT_READINGS_QUERY, tags: ['ok'] })
  })
  it('needs both a valid sort key and direction', () => {
    expect(normaliseQuery({ sort: { key: 'year' } }).sort).toEqual(DEFAULT_READINGS_QUERY.sort)
    expect(normaliseQuery({ sort: { direction: 'asc' } }).sort).toEqual(DEFAULT_READINGS_QUERY.sort)
  })
})

describe('normaliseViewPrefs', () => {
  it('defaults to the table view', () => {
    expect(normaliseViewPrefs(undefined)).toEqual(DEFAULT_VIEW_PREFS)
    expect(normaliseViewPrefs({ view: 'cards' }).view).toBe('table')
  })
  it('keeps the board view and the query fields', () => {
    expect(normaliseViewPrefs({ view: 'board', status: 'read' })).toMatchObject({
      view: 'board',
      status: 'read'
    })
  })
})
