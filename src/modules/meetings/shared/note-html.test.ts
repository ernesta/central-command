import { describe, expect, it } from 'vitest'
import {
  markdownHtml,
  meetingNoteHtml,
  noteBodyHtml,
  noteDetails,
  noteFileName,
  noteFooter
} from './note-html'
import type { MeetingMeta, Person } from './types'

const people: Person[] = [
  { name: 'Ernesta Orlovaitė', initials: 'EO', me: true },
  { name: 'Kathy Rastle', initials: 'KR', me: false }
]

const meta: MeetingMeta = {
  series: 'Supervision',
  date: '2026-11-13',
  start: '10:00',
  end: '11:00',
  mode: 'online',
  attendees: ['Ernesta Orlovaitė', 'Kathy Rastle'],
  discussed: [],
  skills: [],
  task: ''
}

describe('markdownHtml', () => {
  it('prints paragraphs, emphasis, code and escapes what is not markup', () => {
    const html = markdownHtml(
      'A **bold** and *soft* `x < y` <script>alert(1)</script> & more',
      people
    )
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>soft</em>')
    expect(html).toContain('<code>x &lt; y</code>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&amp; more')
  })

  it('prints headings, bullets and nested bullets', () => {
    const html = markdownHtml('### Topic\n- one\n  - inner\n- two', people)
    expect(html).toContain('<h3>Topic</h3>')
    expect(html).toContain('<li>one<ul><li>inner</li></ul></li>')
    expect(html).toContain('<li>two</li>')
  })

  it('prints a mention as its name and a link as its words', () => {
    const html = markdownHtml(
      'With [Kathy Rastle](cc://person/Kathy%20Rastle) and [a site](https://x.org)',
      people
    )
    expect(html).toContain('With Kathy Rastle and a site')
    expect(html).not.toContain('cc://')
    expect(html).not.toContain('x.org')
  })

  it('prints a TODO with its owner named, in a box that is ticked when it is done', () => {
    const html = markdownHtml(
      '- [ ] **TODO (EO)**: Redraft intro\n- [x] **TODO(KR):** Send *figures*',
      people
    )
    expect(html).toContain('<ul class="tasks">')
    expect(html).toContain(
      '<li class="todo"><span class="box"></span><div class="c"><span class="owner">Ernesta Orlovaitė</span> Redraft intro</div></li>'
    )
    expect(html).toContain('<li class="todo done">')
    expect(html).toContain('<span class="owner">Kathy Rastle</span> Send <em>figures</em>')
    expect(html).not.toContain('TODO')
  })

  it('names several owners, keeps unknown initials as written and prints nothing for no owner', () => {
    const html = markdownHtml(
      '- [ ] **TODO (EO & KR)**: Both\n- [ ] **TODO (ZZ)**: Unknown\n- [ ] **TODO**: Nobody',
      people
    )
    expect(html).toContain('Ernesta Orlovaitė &amp; Kathy Rastle</span> Both')
    expect(html).toContain('<span class="owner">ZZ</span> Unknown')
    expect(html).toContain('<div class="c">Nobody</div>')
  })

  it('prints a TODO that is not in a checkbox as a bullet with the owner named', () => {
    const html = markdownHtml('- **TODO (EO)**: Plain one', people)
    expect(html).toContain('<li><span class="owner">Ernesta Orlovaitė</span> Plain one</li>')
  })

  it('leaves a TODO inside code alone', () => {
    const html = markdownHtml('Write `**TODO (EO)**:` like this', people)
    expect(html).toContain('<code>**TODO (EO)**:</code>')
  })

  it('prints tables and quotes', () => {
    const html = markdownHtml('| a | b |\n|---|---|\n| 1 | 2 |\n\n> quoted', people)
    expect(html).toContain('<th>a</th><th>b</th>')
    expect(html).toContain('<td>1</td><td>2</td>')
    expect(html).toContain('<blockquote><p>quoted</p></blockquote>')
  })

  it('does not run on in a long note (the whole text is parsed)', () => {
    const long = `${'word '.repeat(2000)}\n\n- [ ] **TODO (EO)**: at the end`
    expect(markdownHtml(long, people)).toContain(
      '<span class="owner">Ernesta Orlovaitė</span> at the end'
    )
  })
})

describe('noteBodyHtml', () => {
  it('leads with the Summary, labels the rest and leaves Previous TODOs out', () => {
    const html = noteBodyHtml(
      '## Summary\nKey topics: A.\n## Previous TODOs\n- [ ] **TODO (EO)**: old\n## Notes\n### Topic\ntext',
      people
    )
    expect(html).toContain('<div class="summary"><p>Key topics: A.</p></div>')
    expect(html).toContain('<h2>Notes</h2>')
    expect(html).toContain('<h3>Topic</h3>')
    expect(html).not.toContain('old')
    expect(html).not.toContain('Previous')
  })

  it('leaves out an empty section and treats a heading in a code fence as code', () => {
    const html = noteBodyHtml('## Summary\n## Notes\n```\n## Not a heading\n```\n', people)
    expect(html).not.toContain('summary')
    expect(html).toContain('<h2>Notes</h2>')
    expect(html).toContain('<pre>## Not a heading</pre>')
  })
})

describe('meetingNoteHtml', () => {
  it('has the heading, details, attendees and body, and no dashes in the title line', () => {
    const html = meetingNoteHtml({ meta, body: '## Summary\nHello\n## Notes\n- x', people })
    expect(html).toContain('<h1>Supervision · ')
    expect(html).toContain('10:00–11:00 · 1 h · Online')
    expect(html).toContain('Ernesta Orlovaitė, Kathy Rastle')
    expect(html).toContain('<div class="summary"><p>Hello</p></div>')
    expect(html).not.toContain('<script')
  })

  it('escapes the heading and attendees', () => {
    const html = meetingNoteHtml({
      meta: { ...meta, series: '<b>x</b>', attendees: ['A & B'] },
      body: '',
      people
    })
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('A &amp; B')
  })
})

describe('noteDetails, noteFileName and noteFooter', () => {
  it('leaves out what is not known', () => {
    expect(noteDetails({ ...meta, start: null, end: null, mode: null, date: '' })).toBe('')
    expect(noteDetails({ ...meta, end: null, mode: null })).toMatch(/10:00$/)
  })

  it('names the file with spaces and no dashes', () => {
    expect(noteFileName(meta)).toBe('2026 11 13 Supervision.pdf')
    expect(noteFileName({ series: '', date: '' })).toBe('Meeting.pdf')
    expect(noteFileName({ series: 'A/B: C', date: '2026-01-02' })).toBe('2026 01 02 A B C.pdf')
  })

  it('fills in the page count and escapes the title', () => {
    const footer = noteFooter('A & B')
    expect(footer).toContain('A &amp; B')
    expect(footer).toContain('class="pageNumber"')
    expect(footer).toContain('class="totalPages"')
  })
})
