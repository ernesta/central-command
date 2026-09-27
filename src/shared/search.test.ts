import { describe, expect, it } from 'vitest'
import { parseSearchQuery, searchTerms, snippet } from './search'

describe('searchTerms', () => {
  it('splits on spaces and ignores case and accents', () => {
    expect(searchTerms('  Café  LUMINOS ')).toEqual(['cafe', 'luminos'])
    expect(searchTerms('   ')).toEqual([])
  })
})

describe('snippet', () => {
  const text =
    'The data sharing agreement with Luminos covers the ASER data and the ethics application for the first study.'

  it('shows the words around the first match, with … where text was left out', () => {
    const out = snippet(text, ['luminos'])
    expect(out).toContain('Luminos')
    expect(out?.startsWith('…')).toBe(true)
    expect(out?.endsWith('…')).toBe(true)
    expect(out?.length).toBeLessThan(text.length)
  })

  it('starts at the beginning when the match is near it, without a leading …', () => {
    expect(snippet(text, ['data'])?.startsWith('The data sharing')).toBe(true)
  })

  it('takes the earliest of several words and matches ignoring accents and case', () => {
    expect(snippet('Zoë met Émilie today', ['emilie', 'zoe'])).toBe('Zoë met Émilie today')
  })

  it('is null when no word is in the text, and for text whose length changes when folded', () => {
    expect(snippet(text, ['zebra'])).toBeNull()
    expect(snippet('Encyclopædia of data', ['data'])).toBeNull()
  })

  it('cuts at word edges', () => {
    const out = snippet('alpha '.repeat(30) + 'needle ' + 'omega '.repeat(30), ['needle'])!
    expect(out).toContain('needle')
    expect(
      out
        .replace(/…/g, '')
        .trim()
        .split(' ')
        .every((w) => ['alpha', 'needle', 'omega'].includes(w))
    ).toBe(true)
  })
})

describe('parseSearchQuery', () => {
  it('finds nothing to restrict when there is no in:', () => {
    expect(parseSearchQuery('luminos studentship')).toEqual({
      sources: null,
      text: 'luminos studentship'
    })
  })

  it('restricts to one source, singular or plural, and drops the modifier from the text', () => {
    expect(parseSearchQuery('in:meetings luminos')).toEqual({
      sources: ['meetings'],
      text: 'luminos'
    })
    expect(parseSearchQuery('in:meeting luminos')).toEqual({
      sources: ['meetings'],
      text: 'luminos'
    })
    expect(parseSearchQuery('luminos in:reading')).toEqual({
      sources: ['readings'],
      text: 'luminos'
    })
  })

  it('collects more than one in:, without duplicates', () => {
    expect(parseSearchQuery('in:notes in:meetings in:note kathy').sources?.sort()).toEqual([
      'meetings',
      'notes'
    ])
  })

  it('matches every alias to its source', () => {
    expect(parseSearchQuery('in:person x').sources).toEqual(['people'])
    expect(parseSearchQuery('in:people x').sources).toEqual(['people'])
    expect(parseSearchQuery('in:training x').sources).toEqual(['training'])
    expect(parseSearchQuery('in:trainings x').sources).toEqual(['training'])
  })

  it('is case-insensitive for the modifier itself', () => {
    expect(parseSearchQuery('In:Meetings x')).toEqual({ sources: ['meetings'], text: 'x' })
  })

  it('leaves an in: it does not recognise as ordinary text', () => {
    expect(parseSearchQuery('in:progress luminos')).toEqual({
      sources: null,
      text: 'in:progress luminos'
    })
  })

  it('is fine with a modifier and nothing else (search everything in that source)', () => {
    expect(parseSearchQuery('in:meetings')).toEqual({ sources: ['meetings'], text: '' })
  })
})
