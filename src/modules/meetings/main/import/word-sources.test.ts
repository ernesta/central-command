import { describe, expect, it } from 'vitest'
import { parseLongDate, parseSupervisorLog, parseWordHeader } from './word-sources'

describe('parseLongDate', () => {
  it('reads long and short month names', () => {
    expect(parseLongDate('July 9, 2026')).toBe('2026-07-09')
    expect(parseLongDate('Nov 20, 2025')).toBe('2025-11-20')
    expect(parseLongDate('Sept 3, 2025')).toBe('2025-09-03')
    expect(parseLongDate('  Dec. 1, 2025 ')).toBe('2025-12-01')
  })
  it('rejects anything else, including impossible dates', () => {
    for (const bad of ['', 'Feb 30, 2026', 'Smarch 3, 2026', '2026-01-02', 'July 2026', 'July 9']) {
      expect(parseLongDate(bad)).toBeNull()
    }
  })
})

describe('parseWordHeader', () => {
  it('reads the first line with an en dash, hyphen or em dash', () => {
    for (const dash of ['–', '-', '—']) {
      expect(parseWordHeader(`July 9, 2026 | 10:00 ${dash} 11:00\nAttendees: x`)).toEqual({
        date: '2026-07-09',
        start: '10:00',
        end: '11:00'
      })
    }
  })
  it('pads single-digit hours', () => {
    expect(parseWordHeader('October 2, 2025 | 9:00 – 10:30')).toEqual({
      date: '2025-10-02',
      start: '09:00',
      end: '10:30'
    })
  })
  it('skips leading blank lines and rejects other shapes', () => {
    expect(parseWordHeader('\n\nJuly 9, 2026 | 10:00 – 11:00')?.date).toBe('2026-07-09')
    for (const bad of [
      '',
      'July 9, 2026',
      'July 9, 2026 | 10am – 11am',
      'July 9, 2026 | 25:00 – 26:00',
      'Notes\nJuly 9, 2026 | 10:00 – 11:00'
    ]) {
      expect(parseWordHeader(bad)).toBeNull()
    }
  })
})

const LOG = `Student’s Full Name: Ernesta\t\tStudent ID: 1

Status: Full-time

Date of meeting
Type of contact
(visit, email, phone)
Online / in person
Duration
Comments / agreed action points
Initials
Supervisor/Student
Sep 24, 2025
Visit
In person
60 min
Key topics: supervision frequency. Key decisions: meet weekly.
AC
KR
EO
Oct 16, 2025
Teams
Online
15 min
Key topics: ethics.

KR
EO
Oct 22, 2025
Visit
In person
90 min

AC
KR
EO




Record of PGR Student Supervisory Meetings



Page  PAGE   \\* MERGEFORMAT 1
`

describe('parseSupervisorLog', () => {
  const rows = parseSupervisorLog(LOG)
  it('reads a row per date and ignores the header and footer', () => {
    expect(rows.map((r) => r.date)).toEqual(['2025-09-24', '2025-10-16', '2025-10-22'])
  })
  it('reads type, mode, duration and comment', () => {
    expect(rows[0]).toMatchObject({
      contact: 'Visit',
      mode: 'in-person',
      minutes: 60,
      comment: 'Key topics: supervision frequency. Key decisions: meet weekly.'
    })
    expect(rows[1]).toMatchObject({
      contact: 'Teams',
      mode: 'online',
      minutes: 15,
      comment: 'Key topics: ethics.'
    })
  })
  it('reads the initials, where a blank line stands in for someone who was absent', () => {
    expect(rows[0].initials).toEqual(['AC', 'KR', 'EO'])
    expect(rows[1].initials).toEqual(['KR', 'EO'])
  })
  it('copes with an empty comment, and keeps footer text out of the last row', () => {
    expect(rows[2].comment).toBe('')
    expect(rows[2].initials).toEqual(['AC', 'KR', 'EO'])
  })
  it('joins a comment that runs over several lines', () => {
    const multi = parseSupervisorLog(
      'Sep 1, 2025\nVisit\nIn person\n30 min\nFirst part\nsecond part\nKR\nEO\n'
    )
    expect(multi[0].comment).toBe('First part second part')
  })
  it('returns nothing for text with no rows', () => {
    expect(parseSupervisorLog('')).toEqual([])
    expect(parseSupervisorLog('Just some words')).toEqual([])
  })
})
