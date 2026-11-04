import { describe, expect, it } from 'vitest'
import { noteExportDetails, noteExportFileName, noteExportHtml, noteExportTitle } from './note-html'

const meta = { title: 'Methods <b>', group: 'Study 1', subgroup: 'Sample', pinned: false }

describe('note export page', () => {
  it('prints the title, group and text, escaped', () => {
    const html = noteExportHtml({
      meta,
      body: '# Heading\n\nSome **bold** text <script>x</script>\n'
    })
    expect(html).toContain('<h1>Methods &lt;b&gt;</h1>')
    expect(html).toContain('Study 1 · Sample')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).not.toContain('<script>')
  })

  it('keeps links and steps headings down in size', () => {
    const html = noteExportHtml({
      meta,
      body: '# One\n\n## Two\n\n### Three\n\nSee [the plan](https://example.com/a?b=1&c=2) and [a person](cc://person/x).\n'
    })
    expect(html).toContain('<h2>One</h2>')
    expect(html).toContain('<h3>Two</h3>')
    expect(html).toContain('<h4>Three</h4>')
    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2">the plan</a>')
    expect(html).toContain(' and a person.')
    expect(html).not.toContain('cc://')
  })

  it('titles an untitled note by its first line', () => {
    expect(noteExportTitle({ title: '' }, 'First line here\n\nmore')).toBe('First line here more')
    expect(noteExportTitle({ title: '' }, '')).toBe('Untitled')
  })

  it('makes a safe file name and leaves out an empty group line', () => {
    expect(noteExportFileName('a/b: c')).toBe('a b c.pdf')
    expect(noteExportDetails({ group: '', subgroup: '' })).toBe('')
    expect(noteExportHtml({ meta: { ...meta, group: '', subgroup: '' }, body: 'x' })).not.toContain(
      'class="sub"'
    )
  })
})
