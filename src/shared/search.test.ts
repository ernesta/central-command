import { describe, expect, it } from 'vitest'
import { searchTerms, snippet } from './search'

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
