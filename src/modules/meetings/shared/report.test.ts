import { describe, expect, it } from 'vitest'
import { meetingsReportHtml, reportFileName } from './report'
import type { MeetingIndexRow } from './types'

const row = (date: string, over: Partial<MeetingIndexRow> = {}): MeetingIndexRow => ({
  workspace: 'research',
  id: `${date} Supervision`,
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
  todos: [],
  contentHash: 'h',
  ...over
})

const input = (rows: MeetingIndexRow[]): Parameters<typeof meetingsReportHtml>[0] => ({
  rows,
  year: 2025,
  today: '2026-03-01'
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
    expect(html).toContain('<strong>2 h</strong> in 2 meetings')
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

  it('reports meetings without times and totals hours per skill', () => {
    const html = meetingsReportHtml(
      input([
        row('2025-10-01', { skills: ['Communication'] }),
        row('2025-10-08', { start: null, end: null, skills: ['Communication'] })
      ])
    )
    expect(html).toContain('(1 without times, counted as 0)')
    expect(html).toContain('Communication: 1 h')
  })

  it('names the file after the academic year', () => {
    expect(reportFileName(2025)).toBe('Supervision log 2025-26.pdf')
  })
})
