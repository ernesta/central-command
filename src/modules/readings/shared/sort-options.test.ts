import { describe, expect, it } from 'vitest'
import { nextSort, parseSortValue, sortOption, sortValue } from './sort-options'

describe('sortOption', () => {
  it('uses the preset label for preset sorts', () => {
    expect(sortOption({ key: 'year', direction: 'desc' }).label).toBe('Year (newest)')
    expect(sortOption({ key: 'citation', direction: 'asc' }).label).toBe('Author A–Z')
    expect(sortOption({ key: 'updated', direction: 'desc' }).label).toBe('Recently updated')
  })
  it('generates a label for sorts that came from a column header', () => {
    expect(sortOption({ key: 'title', direction: 'asc' })).toEqual({
      value: 'title:asc',
      label: 'Title ↑'
    })
    expect(sortOption({ key: 'citation', direction: 'desc' }).label).toBe('Citation ↓')
  })
})

describe('parseSortValue', () => {
  it('round-trips presets and rejects others', () => {
    expect(parseSortValue('year:asc')).toEqual({ key: 'year', direction: 'asc' })
    expect(parseSortValue(sortValue({ key: 'added', direction: 'desc' }))).toEqual({
      key: 'added',
      direction: 'desc'
    })
    expect(parseSortValue('title:asc')).toBeNull()
  })
})

describe('nextSort', () => {
  it('toggles direction on the current column', () => {
    expect(nextSort({ key: 'title', direction: 'asc' }, 'title')).toEqual({
      key: 'title',
      direction: 'desc'
    })
    expect(nextSort({ key: 'title', direction: 'desc' }, 'title')).toEqual({
      key: 'title',
      direction: 'asc'
    })
  })
  it('starts a new column newest-first for year and A–Z for text', () => {
    expect(nextSort({ key: 'title', direction: 'asc' }, 'year')).toEqual({
      key: 'year',
      direction: 'desc'
    })
    expect(nextSort({ key: 'year', direction: 'desc' }, 'citation')).toEqual({
      key: 'citation',
      direction: 'asc'
    })
    expect(nextSort({ key: 'year', direction: 'desc' }, 'status')).toEqual({
      key: 'status',
      direction: 'asc'
    })
  })
})
