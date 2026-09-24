import { describe, expect, it } from 'vitest'
import { cleanKeywords, mapKeywords } from './keywords'

describe('cleanKeywords', () => {
  it('trims, drops empty values and de-duplicates case-insensitively', () => {
    expect(cleanKeywords([' Econ ', '', '  ', 'econ', 'ECON', 'Policy'])).toEqual([
      'Econ',
      'Policy'
    ])
  })
  it('keeps order of first appearance', () => {
    expect(cleanKeywords(['b', 'a', 'B'])).toEqual(['b', 'a'])
  })
})

describe('mapKeywords', () => {
  it('maps read', () => {
    expect(mapKeywords(['read', 'stats'])).toEqual({ status: 'read', tags: ['stats'] })
  })
  it.each(['to-read', 'To-Read', 'TO READ', 'to read', 'toread', 'ToRead'])(
    'maps %s to to_read',
    (keyword) => {
      expect(mapKeywords([keyword, 'x'])).toEqual({ status: 'to_read', tags: ['x'] })
    }
  )
  it('is case-insensitive for read', () => {
    expect(mapKeywords(['READ']).status).toBe('read')
    expect(mapKeywords(['Read']).status).toBe('read')
  })
  it('lets read win when both are present', () => {
    expect(mapKeywords(['to-read', 'read', 'x'])).toEqual({ status: 'read', tags: ['x'] })
  })
  it('is unset with neither, keeping every keyword as a tag', () => {
    expect(mapKeywords(['a', 'b'])).toEqual({ status: 'unset', tags: ['a', 'b'] })
    expect(mapKeywords([])).toEqual({ status: 'unset', tags: [] })
  })
  it('never shows status keywords as tags, in any variant', () => {
    expect(mapKeywords(['read', 'READ', 'to-read', 'to read', 'toread', 'keep']).tags).toEqual([
      'keep'
    ])
  })
  it('does not treat similar words as status keywords', () => {
    expect(mapKeywords(['reading', 'reader', 'unread', 'to-read-later'])).toEqual({
      status: 'unset',
      tags: ['reading', 'reader', 'unread', 'to-read-later']
    })
  })
  it('de-duplicates tags case-insensitively', () => {
    expect(mapKeywords(['Econ', 'econ', ' econ ']).tags).toEqual(['Econ'])
  })
})
