import { describe, expect, it } from 'vitest'
import { meetingsReportHtml, reportFileName } from './report'
import type { MeetingIndexRow } from './types'

const row = (date: string, over: Partial<MeetingIndexRow> = {}): MeetingIndexRow => ({
  workspace: 'research',
  id: `${date} Supervision`,
  uid: '',
  task: '',
  series: 'Supervision',
  date,
  start: '10:00',
  end: '11:00',
  mode: 'in-person',
  attendees: ['Ernesta Orlovaitė', 'Kathy Rastle'],
  skills: [],
  summary: '',
  excerpt: '',
  problems: [],
  topicCount: 0,
  hasNotes: false,
  todos: [],
  contentHash: 'h',
  ...over
})

const input = (rows: MeetingIndexRow[]): Parameters<typeof meetingsReportHtml>[0] => ({
  rows,
  year: '2025-09-22',
  today: '2026-03-01',
  seriesFilter: 'Supervision'
})

describe('meetingsReportHtml', () => {
  it('lists the Supervision meetings of the year oldest first, leaving out the rest', () => {
    const html = meetingsReportHtml(
      input([
        row('2026-02-01', { summary: 'Second' }),
        row('2025-10-01', { summary: 'First' }),
        row('2026-03-02', { summary: 'Upcoming' }),
        row('2025-08-31', { summary: 'Last year' }),
        row('2025-11-01', { summary: 'Lab', series: 'Rastle Lab' }),
        row('', { summary: 'Planned' })
      ])
    )
    expect(html.indexOf('First')).toBeGreaterThan(-1)
    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'))
    for (const left of ['Upcoming', 'Last year', 'Lab<', 'Planned']) {
      expect(html).not.toContain(left)
    }
    expect(html).toContain('<strong>2:00</strong> in 2 meetings')
  })

  it('escapes everything the user wrote', () => {
    const html = meetingsReportHtml(
      input([
        row('2025-10-01', { summary: '<script>alert(1)</script> & "x"', attendees: ['A <b>B</b>'] })
      ])
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>B</b>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;')
  })

  it('leaves out meetings without times and totals hours per skill', () => {
    const html = meetingsReportHtml(
      input([
        row('2025-10-01', { skills: ['Communication'] }),
        row('2025-10-08', { start: null, end: null, skills: ['Communication'] })
      ])
    )
    expect(html).toContain('in 1 meeting.')
    expect(html).not.toContain('without times')
    expect(html).toContain('Communication: 1:00')
  })

  it('names the file after the year', () => {
    expect(reportFileName('2025-09-22', 'Supervision')).toBe('Supervision log 2025-26.pdf')
    expect(reportFileName('2025-09-22')).toBe('Meetings log 2025-26.pdf')
  })
})

describe('a contract’s report', () => {
  it('names the file and the page after the contract, and keeps to its length', () => {
    expect(reportFileName('2026-05-01', undefined, 'Luminos · May 1, 2026 – Oct 29, 2026')).toBe(
      'Meetings log Luminos · May 1, 2026 - Oct 29, 2026.pdf'
    )
    const html = meetingsReportHtml({
      rows: [row('2026-06-01', { summary: 'inside' }), row('2026-11-02', { summary: 'outside' })],
      year: '2026-05-01',
      weeks: 26,
      label: 'Luminos 1',
      today: '2026-12-01'
    })
    expect(html).toContain('Luminos 1')
    expect(html).toContain('inside')
    expect(html).not.toContain('outside')
  })
})
