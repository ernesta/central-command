import { describe, expect, it } from 'vitest'
import type { Author } from '../shared/types'
import { formatShortCitation } from './citation'

const person = (family: string, given = 'X'): Author => ({ family, given })
const cite = (
  authors: Author[],
  year: number | null = 2020,
  extra: { editors?: Author[]; title?: string; etAl?: boolean } = {}
): string => formatShortCitation({ authors, year, title: extra.title ?? 'A title', ...extra })

describe('formatShortCitation', () => {
  it('uses the surname for one author', () => {
    expect(cite([person('Vaswani')], 2017)).toBe('Vaswani (2017)')
  })

  it('joins two authors with an ampersand', () => {
    expect(cite([person('Smith'), person('Lee')], 2023)).toBe('Smith & Lee (2023)')
  })

  it('uses et al. for three or more authors', () => {
    expect(cite([person('Vaswani'), person('Shazeer'), person('Parmar')], 2017)).toBe(
      'Vaswani et al. (2017)'
    )
    expect(cite([1, 2, 3, 4, 5, 6, 7, 8].map((n) => person(`A${n}`)))).toBe('A1 et al. (2020)')
  })

  it('uses institutional names whole', () => {
    expect(cite([{ literal: 'World Bank' }], 2021)).toBe('World Bank (2021)')
    expect(cite([{ literal: 'Ghana Education Service' }, { literal: 'RTI International' }])).toBe(
      'Ghana Education Service & RTI International (2020)'
    )
  })

  it('handles a mix of person and institution', () => {
    expect(cite([{ literal: 'NORC' }, person('Doe')])).toBe('NORC & Doe (2020)')
  })

  it('keeps accents and multi-word surnames as given', () => {
    expect(cite([{ family: 'Müller' }])).toBe('Müller (2020)')
    expect(cite([{ family: 'van der Berg', given: 'Hans' }, person('Łukasz')])).toBe(
      'van der Berg & Łukasz (2020)'
    )
  })

  it('does not require a given name', () => {
    expect(cite([{ family: 'Plato' }], null)).toBe('Plato (n.d.)')
  })

  it('shows n.d. when there is no year', () => {
    expect(cite([person('Smith')], null)).toBe('Smith (n.d.)')
  })

  it('falls back to editors when there are no authors, with the same rules', () => {
    expect(cite([], 2026, { editors: [person('Eberhard')] })).toBe('Eberhard (2026)')
    expect(cite([], 2017, { editors: [person('Verhoeven'), person('Perfetti')] })).toBe(
      'Verhoeven & Perfetti (2017)'
    )
    expect(cite([], 2026, { editors: [person('A'), person('B'), person('C')] })).toBe(
      'A et al. (2026)'
    )
  })

  it('prefers authors over editors', () => {
    expect(cite([person('Author')], 2020, { editors: [person('Editor')] })).toBe('Author (2020)')
  })

  it('falls back to the first few words of the title with no authors or editors', () => {
    expect(cite([], 2019, { title: 'Learning to read in many languages at once' })).toBe(
      'Learning to read in… (2019)'
    )
    expect(cite([], null, { title: 'Short title' })).toBe('Short title (n.d.)')
  })

  it('strips trailing punctuation from a truncated title lead', () => {
    expect(cite([], 2019, { title: 'Reading: A Study, Of Things' })).toBe(
      'Reading: A Study, Of… (2019)'
    )
    expect(cite([], 2019, { title: 'One two three: four five' })).toBe(
      'One two three: four… (2019)'
    )
    expect(cite([], 2019, { title: 'Alpha beta gamma: delta' })).toBe(
      'Alpha beta gamma: delta (2019)'
    )
  })

  it('handles an empty title with no authors', () => {
    expect(cite([], 2019, { title: '   ' })).toBe('Untitled (2019)')
  })

  it('uses et al. when the source said "and others", even with few named authors', () => {
    expect(cite([person('Smith')], 2020, { etAl: true })).toBe('Smith et al. (2020)')
    expect(cite([person('Smith'), person('Lee')], 2020, { etAl: true })).toBe('Smith et al. (2020)')
  })
})
