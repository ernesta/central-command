import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { SyncedFields } from '../shared/types'
import { BibParseError, parseBib } from './parse-bib'

const fixture = readFileSync(
  join(__dirname, '../../../../tests/fixtures/readings-sample.bib'),
  'utf8'
)
const parsed = parseBib(fixture)
const byKey = (key: string): SyncedFields => {
  const found = parsed.find((r) => r.citekey === key)
  if (!found) throw new Error(`fixture entry missing: ${key}`)
  return found
}

describe('parseBib on the fixture', () => {
  it('parses every entry', () => {
    expect(parsed).toHaveLength(15)
  })

  it('reads a single-author BibLaTeX entry with a full date', () => {
    expect(byKey('vaswaniAttentionAllYou2017')).toEqual({
      citekey: 'vaswaniAttentionAllYou2017',
      shortCitation: 'Vaswani (2017)',
      fullTitle: 'Attention Is All You Need',
      authors: [{ family: 'Vaswani', given: 'Ashish' }],
      year: 2017,
      status: 'read',
      tags: ['nlp', 'transformers'],
      abstract:
        'The dominant sequence transduction models are based on complex recurrent networks.',
      entryType: 'article'
    })
  })

  it('formats two authors and three-plus authors', () => {
    expect(byKey('smithLeeEffectsTreatment2023').shortCitation).toBe('Smith & Lee (2023)')
    expect(byKey('abadieWhenShouldYou2023').shortCitation).toBe('Abadie et al. (2023)')
    expect(byKey('abadieWhenShouldYou2023').authors).toHaveLength(4)
  })

  it('treats double-braced authors as one institution, never splitting them', () => {
    expect(byKey('worldbankLearningPoverty2021').authors).toEqual([{ literal: 'World Bank' }])
    expect(byKey('worldbankLearningPoverty2021').shortCitation).toBe('World Bank (2021)')
    expect(byKey('ghanaMixedInstitutions2019').authors).toEqual([
      { literal: 'Ghana Education Service' },
      { literal: 'RTI International' }
    ])
  })

  it('converts LaTeX accents in names and strips protective braces in titles', () => {
    const r = byKey('muellerLatexAccents2015')
    expect(r.authors).toEqual([
      { family: 'Müller', given: 'Jörg' },
      { family: 'Smíth', given: 'João' },
      { family: 'Łukasz', given: 'Kowalski' }
    ])
    expect(r.fullTitle).toBe('COVID-19 and The Rise of Machine Learning in Zürich')
    expect(r.shortCitation).toBe('Müller et al. (2015)')
  })

  it('decodes special characters in abstracts', () => {
    expect(byKey('muellerLatexAccents2015').abstract).toBe(
      'A 50% increase in öther effects & more, costing $5 per student. Café culture.'
    )
  })

  it('handles duplicate, empty and mixed-status keywords: read wins, no status tags', () => {
    const r = byKey('muellerLatexAccents2015')
    expect(r.status).toBe('read')
    expect(r.tags).toEqual(['Macro', 'Micro'])
  })

  it('maps to-read, and leaves status unset with no status keyword', () => {
    expect(byKey('smithLeeEffectsTreatment2023').status).toBe('to_read')
    expect(byKey('noStatusKeyword2020')).toMatchObject({ status: 'unset', tags: ['misc', 'notes'] })
    expect(byKey('noKeywordsAtAll2020')).toMatchObject({ status: 'unset', tags: [] })
  })

  it('leaves year null and cites (n.d.) when there is no year or date', () => {
    expect(byKey('undatedNoYearBook')).toMatchObject({ year: null, shortCitation: 'Plato (n.d.)' })
  })

  it('takes the year from a plain year field, or from the year part of date', () => {
    expect(byKey('bibtexYearField1999').year).toBe(1999)
    expect(byKey('worldbankLearningPoverty2021').year).toBe(2021)
    expect(byKey('multilineTitle2022').year).toBe(2022)
  })

  it('falls back to editors when there are no authors, storing no authors', () => {
    expect(byKey('editedVolumeOnly2026')).toMatchObject({
      authors: [],
      shortCitation: 'Eberhard et al. (2026)'
    })
    expect(byKey('editorPairOnly2017').shortCitation).toBe('Verhoeven & Perfetti (2017)')
  })

  it('falls back to the title when there are neither authors nor editors', () => {
    expect(byKey('noAuthorNoEditor2019').shortCitation).toBe('A Long Untitled Working… (2019)')
  })

  it('treats "and others" as et al. and does not store "others" as a person', () => {
    const r = byKey('andOthers2018')
    expect(r.authors).toEqual([{ family: 'Kim', given: 'Sam' }])
    expect(r.shortCitation).toBe('Kim et al. (2018)')
  })

  it('collapses whitespace in wrapped titles', () => {
    expect(byKey('multilineTitle2022').fullTitle).toBe('A Title That Was Wrapped Across Lines')
  })

  it('leaves abstract null when absent, and records the entry type', () => {
    expect(byKey('noKeywordsAtAll2020').abstract).toBeNull()
    expect(byKey('worldbankLearningPoverty2021').entryType).toBe('report')
    expect(byKey('editorPairOnly2017').entryType).toBe('incollection')
  })

  it('does not change letter case in titles', () => {
    expect(byKey('smithLeeEffectsTreatment2023').fullTitle).toBe('Effects of Treatment on Outcomes')
  })
})

describe('parseBib failure and edge handling', () => {
  it('throws on an unterminated entry (e.g. a half-written export)', () => {
    expect(() => parseBib('@article{a, title = {Unclosed')).toThrow(BibParseError)
    expect(() => parseBib(`${fixture}\n@article{cut, title = {Cut off`)).toThrow(BibParseError)
  })

  it('throws on an empty file, so an empty export never flags everything as missing', () => {
    expect(() => parseBib('')).toThrow(/no entries/)
    expect(() => parseBib('   \n\n')).toThrow(/no entries/)
    expect(() => parseBib('just some text')).toThrow(/no entries/)
  })

  it('keeps the first of two entries with the same citekey', () => {
    const result = parseBib('@article{dup, title = {First}}\n@article{dup, title = {Second}}')
    expect(result).toHaveLength(1)
    expect(result[0].fullTitle).toBe('First')
  })

  it('also parses classic BibTeX exports', () => {
    const [r] = parseBib(
      '@article{k, title = {A {BibTeX} Title}, author = {Doe, Jane and Roe, Rick}, year = {2001}, keywords = {to read}}'
    )
    expect(r).toMatchObject({
      fullTitle: 'A BibTeX Title',
      shortCitation: 'Doe & Roe (2001)',
      status: 'to_read',
      year: 2001
    })
  })
})
