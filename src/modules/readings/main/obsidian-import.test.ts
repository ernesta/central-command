import { describe, expect, it } from 'vitest'
import type { SyncedFields } from '../shared/types'
import { matchNote, parseObsidianNote, planImport, transformBody } from './obsidian-import'

const reading = (citekey: string, fullTitle: string, year: number | null): SyncedFields => ({
  citekey,
  shortCitation: `${citekey} (${year})`,
  fullTitle,
  authors: [],
  year,
  status: 'unset',
  tags: [],
  abstract: null,
  entryType: 'article'
})

/** A note as Obsidian's Citation plugin creates it. */
const template = (title: string, year: number, notes: string, quotes = '- '): string =>
  `---\nAuthors: A. Author, B. Author\nYear: ${year}\nLink: https://example.org/x\n---\n# ${title}\n\n> An abstract that\n> spans two lines.\n\n---\n## Notes\n${notes}\n\n## Key Quotes\n${quotes}\n`

describe('parseObsidianNote', () => {
  it('reads title, year and the old citekey, and keeps only what follows the header', () => {
    const note = parseObsidianNote(
      '@Cayado2025.md',
      template('The cost of a narrow lens', 2025, '- my point')
    )
    expect(note).toMatchObject({
      oldKey: 'Cayado2025',
      title: 'The cost of a narrow lens',
      year: 2025
    })
    expect(note.body.startsWith('## Notes')).toBe(true)
    expect(note.body).toContain('- my point')
    expect(note.body).not.toContain('abstract')
    expect(note.body).not.toContain('Authors:')
  })
  it('handles Windows line endings', () => {
    const note = parseObsidianNote(
      '@X2020.md',
      template('Some title', 2020, '- point').replace(/\n/g, '\r\n')
    )
    expect(note).toMatchObject({ title: 'Some title', year: 2020 })
    expect(note.body).toContain('- point')
  })
  it('copes with a note that has no header at all', () => {
    const note = parseObsidianNote('@Bare2020.md', '## Notes\n- just this\n')
    expect(note).toMatchObject({ title: '', year: null })
    expect(note.body).toContain('just this')
  })
  it('copes with front matter but no abstract or rule', () => {
    const note = parseObsidianNote('@Y.md', '---\nYear: 2019\n---\n# Title only\n\n## Notes\n- x\n')
    expect(note).toMatchObject({ title: 'Title only', year: 2019 })
    expect(note.body.trim().startsWith('## Notes')).toBe(true)
  })
})

describe('transformBody', () => {
  it('reports a template with only empty bullets as empty', () => {
    expect(transformBody('## Notes\n- \n\n## Key Quotes\n- \n')).toEqual({
      markdown: '',
      empty: true
    })
  })
  it('keeps real content verbatim and drops empty template sections', () => {
    const { markdown, empty } = transformBody('## Notes\n- first\n- second\n\n## Key Quotes\n- \n')
    expect(empty).toBe(false)
    expect(markdown).toBe('## Notes\n\n- first\n- second\n')
  })
  it('keeps every section that has content', () => {
    const { markdown } = transformBody(
      '## Notes\n- a\n\n## Key Quotes\n- "quoted"\n\n## Further Reading\n- b\n'
    )
    expect(markdown).toBe(
      '## Notes\n\n- a\n\n## Key Quotes\n\n- "quoted"\n\n## Further Reading\n\n- b\n'
    )
  })
  it('turns wikilinks into plain text', () => {
    expect(
      transformBody(
        '- see [[Orthographic Features|orthographic features]] and [[Grain Size Theory]]\n'
      ).markdown
    ).toBe('- see orthographic features and Grain Size Theory\n')
    expect(transformBody('- embed ![[Figure 1]] here\n').markdown).toBe('- embed Figure 1 here\n')
  })
  it('leaves ordinary Markdown links alone', () => {
    expect(transformBody('- [a link](https://example.org)\n').markdown).toBe(
      '- [a link](https://example.org)\n'
    )
  })
  it('converts tab indentation to two spaces per level, keeping the nesting', () => {
    expect(transformBody('- top\n\t- child\n\t\t- grandchild\n').markdown).toBe(
      '- top\n  - child\n    - grandchild\n'
    )
  })
  it('puts a blank line after each heading, as the editor does', () => {
    expect(transformBody('## Notes\n- a\n\n## More\n\n- b\n').markdown).toBe(
      '## Notes\n\n- a\n\n## More\n\n- b\n'
    )
  })
  it('puts a blank line before a heading that directly follows a list', () => {
    expect(transformBody('## Notes\n- a\n## More\n- b\n').markdown).toBe(
      '## Notes\n\n- a\n\n## More\n\n- b\n'
    )
  })
  it('strips trailing whitespace from lines', () => {
    expect(transformBody('- a   \n\t- b\t\n').markdown).toBe('- a\n  - b\n')
  })
  it('does not treat a heading-only note as content', () => {
    expect(transformBody('## Notes\n\n## Key Quotes\n').empty).toBe(true)
  })
  it('collapses runs of blank lines and ends with a single newline', () => {
    expect(transformBody('- a\n\n\n\n- b\n\n\n').markdown).toBe('- a\n\n- b\n')
  })
  it('does not drop a bullet that has text or a checkbox', () => {
    expect(transformBody('- [ ] todo\n- text\n').markdown).toBe('- [ ] todo\n- text\n')
  })
})

describe('matchNote', () => {
  const readings = [
    reading(
      'nagHomeLanguageSchool2019',
      'Home Language, School Language and Children’s Literacy Attainments',
      2019
    ),
    reading('nagHomeLearningEnvironments2024', 'Home Learning Environments', 2024),
    reading('pretoriusGettingItRight2019', 'Getting It Right from the Start', 2019),
    reading('twinA2020', 'A Study of Things', 2020),
    reading('twinB2020', 'A study of things', 2020)
  ]
  const note = (title: string, year: number | null): Parameters<typeof matchNote>[0] => ({
    fileName: '@x.md',
    oldKey: 'x',
    title,
    year,
    body: ''
  })

  it('matches on title and year, ignoring case, punctuation and accents', () => {
    const result = matchNote(note('Home learning environments', 2024), readings)
    expect(result).toMatchObject({ status: 'matched', kind: 'title' })
    expect(result.status === 'matched' && result.reading.citekey).toBe(
      'nagHomeLearningEnvironments2024'
    )
    expect(
      matchNote(
        note("Home Language, School Language and Children's Literacy Attainments", 2019),
        readings
      ).status
    ).toBe('matched')
  })
  it('does not match the same title in a different year', () => {
    expect(matchNote(note('Home Learning Environments', 2019), readings).status).toBe('unmatched')
  })
  it('matches a longer note title against a shortened Zotero title when the year agrees', () => {
    const result = matchNote(
      note('Getting it right from the start: Some cautionary notes about literacy in Africa', 2019),
      readings
    )
    expect(result).toMatchObject({ status: 'matched', kind: 'title-prefix' })
    expect(result.status === 'matched' && result.reading.citekey).toBe(
      'pretoriusGettingItRight2019'
    )
  })
  it('does not prefix-match on a very short title', () => {
    expect(matchNote(note('Getting it', 2019), readings).status).toBe('unmatched')
  })
  it('refuses to guess between two equally good candidates', () => {
    const result = matchNote(note('A study of things', 2020), readings)
    expect(result.status).toBe('ambiguous')
    expect(result.status === 'ambiguous' && result.candidates).toHaveLength(2)
  })
  it('is unmatched with no title, or nothing similar', () => {
    expect(matchNote(note('', 2020), readings).status).toBe('unmatched')
    expect(matchNote(note('Completely different', 2020), readings).status).toBe('unmatched')
  })
  it('still matches on an exact title when the note has no year', () => {
    expect(matchNote(note('Home Learning Environments', null), readings).status).toBe('matched')
  })
})

describe('planImport', () => {
  const readings = [
    reading('caladoCostNarrowLens2025', 'The cost of a narrow lens', 2025),
    reading('konishiSixPrinciples2014', 'Six principles of language', 2014),
    reading('munafoManifesto2017', 'A manifesto for reproducible science', 2017)
  ]
  const notes = [
    parseObsidianNote(
      '@Calado2025.md',
      template('The cost of a narrow lens', 2025, '- calado note')
    ),
    parseObsidianNote(
      '@Konishi2014.md',
      template('Six principles of language', 2014, '- konishi note')
    ),
    parseObsidianNote(
      '@Munaf2017.md',
      template('A manifesto for reproducible science', 2017, '- ')
    ),
    parseObsidianNote('@Nobody2001.md', template('Not in the library', 2001, '- x'))
  ]

  it('imports matched notes as new files named after the current citekey', () => {
    const plan = planImport(notes, readings, new Set())
    const first = plan[0]
    expect(first).toMatchObject({
      status: 'import',
      target: 'caladoCostNarrowLens2025.md',
      kind: 'title'
    })
    expect(first.status === 'import' && first.markdown).toBe('## Notes\n\n- calado note\n')
  })
  it('skips empty templates and reports unmatched notes', () => {
    const plan = planImport(notes, readings, new Set())
    expect(plan.map((p) => p.status)).toEqual(['import', 'import', 'skip-empty', 'unmatched'])
  })
  it('never overwrites: a reading that already has a notes file is skipped', () => {
    const plan = planImport(notes, readings, new Set(['konishiSixPrinciples2014.md']))
    expect(plan[1]).toMatchObject({ status: 'skip-exists', target: 'konishiSixPrinciples2014.md' })
  })
  it('imports only the first of two notes that map to the same reading', () => {
    const dup = [
      parseObsidianNote('@A.md', template('The cost of a narrow lens', 2025, '- one')),
      parseObsidianNote('@B.md', template('The cost of a narrow lens', 2025, '- two'))
    ]
    const plan = planImport(dup, readings, new Set())
    expect(plan.map((p) => p.status)).toEqual(['import', 'skip-duplicate'])
    expect(plan[1]).toMatchObject({ firstNote: '@A.md' })
  })
  it('is idempotent: planning again after importing skips everything', () => {
    const first = planImport(notes, readings, new Set())
    const written = new Set(first.flatMap((p) => (p.status === 'import' ? [p.target] : [])))
    const second = planImport(notes, readings, written)
    expect(second.filter((p) => p.status === 'import')).toEqual([])
  })
})
