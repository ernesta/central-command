import { describe, expect, it } from 'vitest'
import { applyCitations, proposeCitations, type CitableReading } from './citations'

const readings: CitableReading[] = [
  { citekey: 'castles2018', authors: ['Castles', 'Musso', 'Nation'], year: 2018 },
  { citekey: 'castlesColtheart2004', authors: ['Castles', 'Coltheart'], year: 2004 },
  { citekey: 'evansAcosta2020', authors: ['Evans', 'Acosta'], year: 2020 },
  { citekey: 'kimA2020', authors: ['Kim', 'Lee', 'Zuilkowski'], year: 2020 },
  { citekey: 'kimB2020', authors: ['Kim', 'Park', 'Roe'], year: 2020 },
  { citekey: 'kim2018', authors: ['Kim'], year: 2018 },
  { citekey: 'taylor2016', authors: ['Taylor', 'von Fintel'], year: 2016 },
  { citekey: 'worldbankLoudClearEffective2021', authors: ['World Bank'], year: 2021 },
  { citekey: 'koda2008', authors: ['Koda', 'Reddy'], year: 2008 }
]

const link = (t: string): string => applyCitations(t, proposeCitations(t, readings))

describe('citations', () => {
  it('links the shapes people write', () => {
    expect(link('like Castles et al., 2018) here')).toBe(
      'like [Castles et al., 2018](cc://reading/castles2018)) here'
    )
    expect(link('(e.g., Castles & Coltheart, 2004)')).toContain(
      '(cc://reading/castlesColtheart2004)'
    )
    expect(link('Evans and Acosta (2020) say')).toBe(
      '[Evans and Acosta (2020)](cc://reading/evansAcosta2020) say'
    )
    expect(link('Taylor & von Fintel (2016)')).toContain('cc://reading/taylor2016')
    expect(link('Kim (2018)')).toContain('cc://reading/kim2018')
  })
  it('never guesses between two readings', () => {
    const p = proposeCitations('Kim et al. (2020)', readings)
    expect(p[0].resolution).toEqual({ kind: 'ambiguous', citekeys: ['kimA2020', 'kimB2020'] })
    expect(link('Kim et al. (2020)')).toBe('Kim et al. (2020)')
  })
  it('does not link a different number of authors', () => {
    expect(proposeCitations('Koda (2008)', readings)[0].resolution.kind).toBe('loose')
    expect(link('Koda (2008)')).toBe('Koda (2008)')
  })
  it('skips leading words that are not surnames', () => {
    expect(link('Pedagogical, Koda and Reddy (2008)')).toBe(
      'Pedagogical, [Koda and Reddy (2008)](cc://reading/koda2008)'
    )
  })
  it('leaves links, code, headings and front matter alone', () => {
    const t =
      '---\ntitle: Kim (2018)\n---\n# Kim (2018)\n[Kim (2018)](https://x.org) `Kim (2018)`\n'
    expect(link(t)).toBe(t)
  })
  it('reports citations with no reading and ignores dates', () => {
    expect(proposeCitations('Nobody (2001)', readings)[0].resolution.kind).toBe('none')
    expect(proposeCitations('Liberia 2024-25, in 2026', readings)).toEqual([])
  })
  it('links works named by title', () => {
    expect(link('the _Loud and Clear_ paper, and loud and clear')).toBe(
      'the _[Loud and Clear](cc://reading/worldbankLoudClearEffective2021)_ paper, and [loud and clear](cc://reading/worldbankLoudClearEffective2021)'
    )
    expect(link('### Loud and Clear')).toBe('### Loud and Clear')
  })
})
