import { describe, expect, it } from 'vitest'
import {
  applyCitations,
  applyCitekeys,
  findCitekeyMarkers,
  proposeCitations,
  proposeCitekeys,
  undoCitekeys,
  unreadableCitekeys,
  type CitableReading
} from './citations'

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

const marked = (t: string): string => applyCitekeys(t, proposeCitekeys(t, readings))

describe('citekey markers', () => {
  it('reads the surname and year out of a marker', () => {
    const [m] = findCitekeyMarkers('as [@Castles2018] shows')
    expect(m).toMatchObject({ name: 'Castles', year: 2018, suffix: '', text: '[@Castles2018]' })
    expect(findCitekeyMarkers('[@Kim2018a]')[0].suffix).toBe('a')
    expect(findCitekeyMarkers('[@Melby-Lervåg2011]')[0].name).toBe('Melby-Lervåg')
  })
  it('writes the surnames the way the library does', () => {
    expect(marked('[@Kim2018] says')).toBe('[Kim (2018)](cc://reading/kim2018) says')
    expect(marked('[@Castles2004] say')).toBe(
      '[Castles & Coltheart (2004)](cc://reading/castlesColtheart2004) say'
    )
    expect(marked('[@Castles2018] say')).toBe(
      '[Castles et al. (2018)](cc://reading/castles2018) say'
    )
  })
  it('is a reference in brackets only when it closes them', () => {
    expect(marked('phonics (e.g., following [@Kim2018]) works')).toBe(
      'phonics (e.g., following [Kim, 2018](cc://reading/kim2018)) works'
    )
    expect(marked('the point ([@Kim2018]).')).toBe('the point ([Kim, 2018](cc://reading/kim2018)).')
    // Read out by the sentence, so the name keeps its brackets even inside brackets of its own.
    expect(marked('(like the work [@Kim2018] describes)')).toBe(
      '(like the work [Kim (2018)](cc://reading/kim2018) describes)'
    )
    // A closing bracket with none open is the writer's, not ours.
    expect(marked('see [@Kim2018]) there')).toBe('see [Kim (2018)](cc://reading/kim2018)) there')
    // Brackets inside an earlier link are not open brackets.
    expect(marked('[Kim (2018)](cc://reading/kim2018) and [@Castles2004] next')).toContain(
      '[Castles & Coltheart (2004)](cc://reading/castlesColtheart2004) next'
    )
  })
  it('never guesses between two readings, and leaves an unknown one alone', () => {
    expect(proposeCitekeys('[@Kim2020]', readings)[0].resolution).toEqual({
      kind: 'ambiguous',
      citekeys: ['kimA2020', 'kimB2020']
    })
    expect(marked('[@Kim2020]')).toBe('[@Kim2020]')
    expect(proposeCitekeys('[@Harm2004]', readings)[0].resolution).toEqual({ kind: 'none' })
    expect(marked('[@Harm2004]')).toBe('[@Harm2004]')
  })
  it('leaves protected text alone', () => {
    expect(marked('# [@Kim2018]')).toBe('# [@Kim2018]')
    expect(marked('`[@Kim2018]`')).toBe('`[@Kim2018]`')
    expect(marked('```\n[@Kim2018]\n```')).toBe('```\n[@Kim2018]\n```')
    expect(marked('---\ntitle: [@Kim2018]\n---\n\nbody')).toBe(
      '---\ntitle: [@Kim2018]\n---\n\nbody'
    )
  })
  it('reports marker-shaped text it does not understand', () => {
    expect(unreadableCitekeys('[@Kim2018] and [@kim_2018_impact]').map((u) => u.text)).toEqual([
      '[@kim_2018_impact]'
    ])
    expect(unreadableCitekeys('[@Kim2018; @Castles2018]').map((u) => u.text)).toEqual([
      '[@Kim2018; @Castles2018]'
    ])
  })
  it('undoes its own rewrite exactly', () => {
    const text = 'As [@Kim2018] shows (e.g., [@Castles2004]), and [@Kim2020] is unknown.'
    const proposals = proposeCitekeys(text, readings)
    expect(undoCitekeys(applyCitekeys(text, proposals), proposals)).toBe(text)
  })
})
