import { describe, expect, it } from 'vitest'
import { splitNote } from '../../shared/front-matter'
import {
  checkConversion,
  convertNote,
  importedFromOf,
  planNoteImport,
  titleOf,
  type SourceNote
} from './note-import'

const src = (path: string, content: string, created = '2025-03-02'): SourceNote => ({
  path,
  content,
  created
})

describe('convertNote', () => {
  it('adds a title, created date and origin to a note with no front matter, and copies the text as it is', () => {
    const body = '# ASER\r\n\n- [x] done\n- [ ] open  \n\n[[Link]] and ![[image.png]]\n\n\n'
    const { markdown, title } = convertNote(src('Data Sources/ASER.md', body))
    expect(title).toBe('ASER')
    expect(markdown).toBe(
      `---\ntitle: ASER\ncreated: 2025-03-02\nimported-from: Data Sources/ASER.md\n---\n\n${body}`
    )
    expect(splitNote(markdown).body).toBe(body)
  })

  it('keeps front matter the note already had, adding only what is missing', () => {
    const content = '---\ntags: [thesis, ideas]\ntitle: My own title\n# a comment\n---\n\nText\n'
    const { markdown } = convertNote(src('Ideas/Thing.md', content))
    expect(markdown).toContain('tags: [thesis, ideas]')
    expect(markdown).toContain('title: My own title')
    expect(markdown).toContain('# a comment')
    expect(markdown).toContain('created: 2025-03-02')
    expect(markdown).toContain('imported-from: Ideas/Thing.md')
    expect(markdown).not.toContain('title: Thing')
    expect(splitNote(markdown).body).toBe('Text\n')
  })

  it('leaves created out when the vault does not say, and never adds a group', () => {
    const { markdown } = convertNote(src('Thesis/Journals.md', 'x', ''))
    expect(markdown).not.toContain('created')
    expect(markdown).not.toContain('group')
  })

  it('quotes a title that needs it', () => {
    const { markdown } = convertNote(src('Ideas/What: why.md', 'x'))
    expect(markdown).toContain("title: 'What: why'")
  })
})

describe('checkConversion', () => {
  const source = src(
    'Ideas/A.md',
    '---\ntags: [a]\n---\n\n- [x] one\n- [ ] two\n**TODO(EO)**: call\n'
  )
  const good = convertNote(source).markdown

  it('accepts a faithful conversion', () => {
    expect(checkConversion(source, good)).toEqual([])
  })

  it('catches a changed text, a lost box, a lost TODO and a lost line', () => {
    const body = splitNote(good).body
    const head = splitNote(good).head
    expect(checkConversion(source, head + body.trimEnd())).toContain(
      'The text is not the same as in the vault'
    )
    expect(checkConversion(source, head + body.replace('- [x]', '- [ ]'))).toContain(
      'The number of ticked boxes changed'
    )
    expect(checkConversion(source, head + body.replace('TODO', 'todo'))).toContain('A TODO changed')
    expect(checkConversion(source, head + body.replace('\n**TODO', '**TODO'))).toContain(
      'The line count changed'
    )
  })

  it('catches a lost line of the note’s own front matter', () => {
    expect(checkConversion(source, good.replace('tags: [a]\n', ''))).toContain(
      'The note’s own front matter changed'
    )
  })

  it('catches a result that does not read back as a note', () => {
    const noTitle = good.replace(/title: A\n/, '')
    expect(checkConversion(source, noTitle)).toContain('The note has no title')
    const badDate = good.replace('created: 2025-03-02', 'created: last week')
    expect(checkConversion(source, badDate).join()).toContain('Invalid created date')
  })
})

describe('planNoteImport', () => {
  it('imports each note under its own name, ungrouped', () => {
    const plan = planNoteImport([src('Ideas/A.md', 'a'), src('Thesis/B.md', 'b')], [])
    expect(plan.map((p) => p.status === 'import' && p.target)).toEqual(['A.md', 'B.md'])
  })

  it('never takes a name that is in use, in the folder or earlier in the plan', () => {
    const plan = planNoteImport(
      [src('Ideas/Notes.md', 'a'), src('Thesis/Notes.md', 'b'), src('Placement/notes.md', 'c')],
      ['Notes.md']
    )
    expect(plan.map((p) => p.status === 'import' && p.target)).toEqual([
      'Notes 2.md',
      'Notes 3.md',
      'notes 4.md'
    ])
  })

  it('skips a note an earlier run brought over, so a second run adds nothing', () => {
    const first = planNoteImport([src('Ideas/A.md', 'a')], [])
    const written = first[0].status === 'import' ? first[0] : null
    const found = importedFromOf([{ name: written!.target, content: written!.markdown }])
    expect(found.get('Ideas/A.md')).toBe('A.md')
    const second = planNoteImport([src('Ideas/A.md', 'a')], ['A.md'], found)
    expect(second).toEqual([
      { status: 'skip-imported', source: src('Ideas/A.md', 'a'), existing: 'A.md' }
    ])
  })

  it('leaves out a note whose conversion does not match its source', () => {
    // A vault note whose front matter is broken in a way the converter cannot keep faithfully.
    const odd = src('Ideas/Odd.md', '---\ncreated: yesterday\n---\n\nText\n')
    const plan = planNoteImport([odd, src('Ideas/Fine.md', 'ok')], [])
    expect(plan[0]).toMatchObject({ status: 'failed-check' })
    expect(plan[1]).toMatchObject({ status: 'import', target: 'Fine.md' })
  })

  it('reads a note’s name', () => {
    expect(titleOf('Data Sources/UK National Pupil Database.md')).toBe('UK National Pupil Database')
  })
})
