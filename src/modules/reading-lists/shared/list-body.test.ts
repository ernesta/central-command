import { describe, expect, it } from 'vitest'
import { parseListBody } from './list-body'

describe('parseListBody', () => {
  it('reads sections and their entries, linked and placeholder', () => {
    const body = [
      '## What do the reviews conclude?',
      '',
      '- **@kim2020** Meta-analysis of 67 studies; no lasting difference in reading outcomes.',
      '- **Melby-Lervåg & Lervåg (2014). Reading comprehension. Psych Bulletin, 140(2), 409–433.** Far behind on comprehension.',
      '',
      '## Does home language instruction improve learning?',
      '',
      '- **@taylor2016** Pupils taught in English scored lower.'
    ].join('\n')
    const sections = parseListBody(body)
    expect(sections.map((s) => s.heading)).toEqual([
      'What do the reviews conclude?',
      'Does home language instruction improve learning?'
    ])
    expect(sections[0].entries).toEqual([
      {
        kind: 'linked',
        citekey: 'kim2020',
        annotation: 'Meta-analysis of 67 studies; no lasting difference in reading outcomes.',
        offset: body.indexOf('- **@kim2020**')
      },
      {
        kind: 'placeholder',
        citation:
          'Melby-Lervåg & Lervåg (2014). Reading comprehension. Psych Bulletin, 140(2), 409–433.',
        annotation: 'Far behind on comprehension.',
        offset: body.indexOf('- **Melby-Lervåg')
      }
    ])
    expect(sections[1].entries).toEqual([
      {
        kind: 'linked',
        citekey: 'taylor2016',
        annotation: 'Pupils taught in English scored lower.',
        offset: body.indexOf('- **@taylor2016**')
      }
    ])
  })

  it('gives a bullet with no leading bold run "missing", not dropped', () => {
    const body = '## A section\n\n- just some prose, no citation yet\n'
    expect(parseListBody(body)).toEqual([
      {
        heading: 'A section',
        entries: [
          {
            kind: 'missing',
            annotation: 'just some prose, no citation yet',
            offset: body.indexOf('- just')
          }
        ]
      }
    ])
  })

  it('drops a bullet before any heading, and ignores a heading in a code fence', () => {
    const body = ['- before any section', '## Real section', '```', '## Not a section', '```'].join(
      '\n'
    )
    const sections = parseListBody(body)
    expect(sections).toHaveLength(1)
    expect(sections[0].heading).toBe('Real section')
    expect(sections[0].entries).toEqual([])
  })

  it('keeps a `###` under a section as decoration, not a new section', () => {
    const body = '## Section\n\n### A sub-heading\n\n- **@x** note\n'
    const sections = parseListBody(body)
    expect(sections).toHaveLength(1)
    expect(sections[0].entries).toHaveLength(1)
  })

  it('does not confuse bold text inside the annotation with the citation', () => {
    const body = '## S\n\n- **@x** Findings held even for the **strongest** readers.\n'
    expect(parseListBody(body)[0].entries[0]).toMatchObject({
      kind: 'linked',
      citekey: 'x',
      annotation: 'Findings held even for the **strongest** readers.'
    })
  })
})

describe('parseListBody, entity entries', () => {
  it('reads a leading reading entity as linked, with or without the old long reference text', () => {
    const body = [
      '## S',
      '',
      '- **[Kim et al. (2020)](cc://reading/kim2020)** Short form.',
      '- **[Kim et al. (2020)](cc://reading/kim2020). Title. Journal, 1(2).** Old form.',
      '- **[Kim](https://example.org)** a web link is still a typed citation'
    ].join('\n')
    const entries = parseListBody(body)[0].entries
    expect(entries[0]).toMatchObject({
      kind: 'linked',
      citekey: 'kim2020',
      annotation: 'Short form.'
    })
    expect(entries[1]).toMatchObject({
      kind: 'linked',
      citekey: 'kim2020',
      annotation: 'Old form.'
    })
    expect(entries[2].kind).toBe('placeholder')
  })
})
