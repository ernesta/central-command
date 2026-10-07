import { describe, expect, it } from 'vitest'
import { reportFileName, trainingReportHtml } from './report'
import type { TrainingIndexRow } from './types'

const row = (date: string, over: Partial<TrainingIndexRow> = {}): TrainingIndexRow => ({
  workspace: 'research',
  id: `${date} Talk`,
  date,
  start: '10:00',
  end: '11:30',
  title: 'Talk',
  series: null,
  type: null,
  mode: null,
  skills: [],
  leads: [],
  institution: null,
  folder: null,
  task: '',
  summary: '',
  excerpt: '',
  hasNotes: false,
  problems: [],
  contentHash: 'h',
  ...over
})

const input = (rows: TrainingIndexRow[]): Parameters<typeof trainingReportHtml>[0] => ({
  rows,
  year: '2025-09-22',
  today: '2026-03-01',
  aimHours: 200,
  meetingMinutes: 0
})

describe('trainingReportHtml', () => {
  it('lists the year oldest first, leaving out other years and upcoming entries', () => {
    const html = trainingReportHtml(
      input([
        row('2026-02-01', { title: 'Second' }),
        row('2025-10-01', { title: 'First' }),
        row('2026-03-02', { title: 'Upcoming' }),
        row('2025-08-31', { title: 'Last year' })
      ])
    )
    expect(html.indexOf('First')).toBeGreaterThan(-1)
    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'))
    expect(html).not.toContain('Upcoming')
    expect(html).not.toContain('Last year')
    expect(html).toContain('<strong>3 h</strong> of 200 h in 2 entries')
  })

  it('escapes everything the user wrote', () => {
    const html = trainingReportHtml(
      input([
        row('2025-10-01', { title: '<script>alert(1)</script> & "x"', leads: ['A <b>B</b>'] })
      ])
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>B</b>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;')
  })

  it('shows hours per skill, leads by full name and the meetings line only when there are meetings', () => {
    const html = trainingReportHtml({
      ...input([row('2025-10-01', { skills: ['Networking (RP)'], leads: ['Robert Darby'] })]),
      meetingMinutes: 90
    })
    expect(html).toContain('Networking (RP): 1.5 h')
    expect(html).toContain('Robert Darby')
    expect(html).toContain('Plus 1.5 h of meetings')
    expect(trainingReportHtml(input([row('2025-10-01')]))).not.toContain('of meetings')
  })

  it('names the file after the year', () => {
    expect(reportFileName('2025-09-22')).toBe('Training log 2025-26.pdf')
  })
})

describe('trainingReportHtml with self-study', () => {
  const rows = [
    row('2025-10-01', { title: 'Lecture', task: 'k1' }),
    row('2025-10-02', { title: 'Other' })
  ]
  it('is the same page when there is no self-study', () => {
    expect(trainingReportHtml({ ...input(rows), selfStudy: new Map() })).toBe(
      trainingReportHtml(input(rows))
    )
  })
  it('shows a lecture as one total: its session plus the time tracked on it', () => {
    const html = trainingReportHtml({ ...input(rows), selfStudy: new Map([['k1', 45]]) })
    // A 90-minute session plus 45 minutes of self-study is 2.3 h; the other entry stays 1.5 h, 3.8 h in all.
    expect(html).toContain('<td class="nw r">2.3 h</td>')
    expect(html).toContain('<strong>3.8 h</strong> of 200 h in 2 entries')
  })
})
