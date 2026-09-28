import { describe, expect, it } from 'vitest'
import { planListImport } from './list-import'

const html = (body: string): string => `<html><body>${body}</body></html>`

describe('planListImport', () => {
  it('reads a heading and its entries, splitting citation from annotation at the en dash', () => {
    const result = planListImport(
      html(
        '<p class="p1"><b>Does it work?</b></p>' +
          '<ul><li><b>Smith (2020)</b>. A paper. <i>Journal</i>, 1(2), 3–4. – It works.</li></ul>'
      )
    )
    expect(result.sectionCount).toBe(1)
    expect(result.entryCount).toBe(1)
    expect(result.problems).toEqual([])
    expect(result.sections).toEqual([
      {
        heading: 'Does it work?',
        entries: [
          { citation: 'Smith (2020). A paper. Journal, 1(2), 3–4.', annotation: 'It works.' }
        ]
      }
    ])
    expect(result.body).toBe(
      '## Does it work?\n\n- **Smith (2020). A paper. Journal, 1(2), 3–4.** It works.\n'
    )
  })

  it('does not split on an en dash inside a page range, only on one with spaces round it', () => {
    const result = planListImport(
      html(
        '<p class="p1"><b>Heading</b></p>' +
          '<ul><li>Author (2021). Title. Journal, 10(1), 100–120. – The annotation.</li></ul>'
      )
    )
    expect(result.sections[0].entries[0]).toEqual({
      citation: 'Author (2021). Title. Journal, 10(1), 100–120.',
      annotation: 'The annotation.'
    })
  })

  it('keeps a whole entry as the citation, and reports it, when there is no annotation', () => {
    const result = planListImport(
      html('<p class="p1"><b>Heading</b></p><ul><li>Just a citation, no dash.</li></ul>')
    )
    expect(result.sections[0].entries[0]).toEqual({
      citation: 'Just a citation, no dash.',
      annotation: ''
    })
    expect(result.problems).toEqual([expect.stringContaining('No annotation found')])
  })

  it('drops and reports an entry that appears before any heading', () => {
    const result = planListImport(html('<ul><li>Stray – entry.</li></ul>'))
    expect(result.sectionCount).toBe(0)
    expect(result.entryCount).toBe(0)
    expect(result.problems).toEqual([expect.stringContaining('dropped')])
  })

  it('keeps two headings and their own entries separate', () => {
    const result = planListImport(
      html(
        '<p class="p1"><b>First?</b></p><ul><li>A – a.</li></ul>' +
          '<p class="p1"><b>Second?</b></p><ul><li>B – b.</li></ul>'
      )
    )
    expect(result.sections.map((s) => s.heading)).toEqual(['First?', 'Second?'])
    expect(result.sections[0].entries).toHaveLength(1)
    expect(result.sections[1].entries).toHaveLength(1)
  })

  // A mutation check (CLAUDE.md: safety-critical logic should be deliberately broken to confirm a test
  // catches it): a split that silently truncates the annotation must never be allowed to write a file.
  it('refuses to proceed when an injected bad split loses text, via the round-trip safety check', () => {
    const dropLastWord = (text: string): { citation: string; annotation: string } => {
      const cut = text.slice(0, text.lastIndexOf(' '))
      return { citation: cut, annotation: '' }
    }
    expect(() =>
      planListImport(
        html(
          '<p class="p1"><b>Heading</b></p>' +
            '<ul><li>Author (2021) – Some annotation text.</li></ul>'
        ),
        dropLastWord
      )
    ).toThrow(/Safety check failed/)
  })
})
