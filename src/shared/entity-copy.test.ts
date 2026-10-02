import { describe, expect, it } from 'vitest'
import { markdownFromCopy, readableCopy, type CopyPart } from './entity-copy'

const KATHY = '[Kathy](cc://person/Kathy%20Rastle)'
const KIM = '[Kim et al. (2020)](cc://reading/kim2020)'
const LEE = '[Lee & Park (2019)](cc://reading/lee2019)'
const MEETING = '[Supervision, 3 Oct 2026](cc://meeting/k3f9a2x1)'

const parts: Record<string, CopyPart> = {
  'person/Kathy Rastle': { text: 'Kathy Rastle' },
  'reading/kim2020': {
    text: 'Kim et al. (2020)',
    reference: { text: 'Kim, A. (2020). Zebra. J.', html: 'Kim, A. (2020). <i>Zebra</i>. J.' }
  },
  'reading/lee2019': {
    text: 'Lee and Park (2019)',
    reference: { text: 'Lee, B. (2019). Apple. J.', html: 'Lee, B. (2019). <i>Apple</i>. J.' }
  }
}
const lookup = (ref: { kind: string; key: string }): CopyPart | null =>
  parts[`${ref.kind}/${ref.key}`] ?? null

describe('readableCopy', () => {
  it('writes a person as their full name and leaves other text alone', () => {
    expect(readableCopy(`Met ${KATHY} today. **Bold** stays.`, lookup).text).toBe(
      'Met Kathy Rastle today. **Bold** stays.'
    )
  })

  it('writes a meeting or note as its label', () => {
    expect(readableCopy(`See ${MEETING}.`, lookup).text).toBe('See Supervision, 3 Oct 2026.')
  })

  it('lists the references of the readings after the text, alphabetical, each once', () => {
    const out = readableCopy(`${KIM} and ${LEE}; again ${KIM}.`, lookup)
    expect(out.text).toBe(
      'Kim et al. (2020) and Lee and Park (2019); again Kim et al. (2020).\n\n' +
        'References\nKim, A. (2020). Zebra. J.\nLee, B. (2019). Apple. J.'
    )
    expect(out.html).toContain('<p>Kim, A. (2020). <i>Zebra</i>. J.</p>')
  })

  it('adds no references heading without readings', () => {
    expect(readableCopy(KATHY, lookup).text).not.toContain('References')
  })

  it('falls back to the label for something that cannot be looked up', () => {
    expect(readableCopy('[Gone](cc://reading/gone)', lookup).text).toBe('Gone')
  })

  it('does not touch mentions inside fenced code, or ordinary links', () => {
    const md = '```\n' + KATHY + '\n```\n[site](https://x.org)'
    expect(readableCopy(md, lookup).text).toBe(md)
  })

  it('carries the Markdown in the HTML so a paste into the app can restore it', () => {
    const md = `A "quoted" <b> & ${KIM}\nsecond`
    expect(markdownFromCopy(readableCopy(md, lookup).html)).toBe(md)
  })
})

describe('markdownFromCopy', () => {
  it('is null for anyone else’s HTML', () => {
    expect(markdownFromCopy('<b>bold</b>')).toBeNull()
  })
})
