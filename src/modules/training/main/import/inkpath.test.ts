import { describe, expect, it } from 'vitest'
import {
  isMeetingRow,
  limitSkills,
  looksLikePerson,
  parseInkpathDate,
  parseInkpathRows,
  parseInkpathTime,
  seriesOfRow,
  splitSkills
} from './inkpath'

const HEADER = [
  'Name',
  'Type',
  'Attendance Type',
  'Description',
  'Organisation',
  'Provider',
  'Start Date',
  'Start Time',
  'End Date',
  'End Time',
  'Date Completed',
  'Hours',
  'Points',
  'Skills',
  'Notes'
]

describe('dates and times', () => {
  it('reads dd/mm/yyyy and Excel serials, and refuses impossible dates', () => {
    expect(parseInkpathDate('01/04/2026')).toBe('2026-04-01')
    expect(parseInkpathDate('1/4/2026')).toBe('2026-04-01')
    expect(parseInkpathDate('46113')).toBe('2026-04-01')
    expect(parseInkpathDate('31/02/2026')).toBe('')
    expect(parseInkpathDate('2026-04-01')).toBe('')
    expect(parseInkpathDate('')).toBe('')
  })

  it('reads times with or without seconds and as a day fraction', () => {
    expect(parseInkpathTime('11:00:00')).toBe('11:00')
    expect(parseInkpathTime('9:05')).toBe('09:05')
    expect(parseInkpathTime('0.5')).toBe('12:00')
    expect(parseInkpathTime('25:00')).toBe('')
    expect(parseInkpathTime('later')).toBe('')
  })
})

describe('parseInkpathRows', () => {
  it('finds columns by header name and skips blank rows', () => {
    const { rows, problems } = parseInkpathRows([
      HEADER,
      [
        'Talk',
        'Activity',
        'Live (online)',
        'About\r\nthings',
        'SEDarc DTP',
        'LSE',
        '01/04/2026',
        '11:00:00',
        '01/04/2026',
        '13:00:00',
        '',
        '2',
        '1',
        'Networking (RP)',
        ''
      ],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
    ])
    expect(problems).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      row: 2,
      name: 'Talk',
      description: 'About\nthings',
      startDate: '2026-04-01',
      startTime: '11:00',
      endTime: '13:00',
      hours: 2,
      points: '1'
    })
  })

  it('stops with a message when a column is missing', () => {
    const res = parseInkpathRows([['Name', 'Skills']])
    expect(res.rows).toEqual([])
    expect(res.problems[0]).toContain('"Description"')
  })
})

describe('splitSkills', () => {
  it('maps known skills to the app names, in the order written', () => {
    expect(splitSkills('Data Management and analysis (GS), Quantitative Skills (GS)')).toEqual({
      known: ['Data management and analysis (GS)', 'Quantitative skills (GS)'],
      unknown: []
    })
  })

  it('keeps the same name with different tags apart and reports what it does not know', () => {
    const res = splitSkills(
      'Quantitative Skills (SS), Making your research transparent (Live), Networking (RP)'
    )
    expect(res.known).toEqual(['Quantitative skills (SS)', 'Networking (RP)'])
    expect(res.unknown).toEqual(['Making your research transparent (Live)'])
  })

  it('limits to three and returns the rest', () => {
    expect(limitSkills(['a', 'b', 'c', 'd', 'e'])).toEqual({
      kept: ['a', 'b', 'c'],
      extra: ['d', 'e']
    })
    expect(splitSkills('').known).toEqual([])
  })
})

describe('classifying rows', () => {
  it('recognises supervisor and lab meetings', () => {
    expect(isMeetingRow({ name: 'Supervisor Meeting Apr 1, 2026' })).toBe(true)
    expect(isMeetingRow({ name: 'Rastle Lab meeting' })).toBe(true)
    expect(isMeetingRow({ name: 'Research Training Seminar' })).toBe(false)
  })

  it('sets a series from the provider, the title or the organisation', () => {
    expect(seriesOfRow({ name: 'x', provider: 'DataCamp', organisation: '' })).toBe('DataCamp')
    expect(
      seriesOfRow({ name: 'DataCamp: Python', provider: 'Royal Holloway', organisation: '' })
    ).toBe('DataCamp')
    expect(seriesOfRow({ name: 'x', provider: 'Royal Holloway', organisation: 'SEDarc DTP' })).toBe(
      'SEDarc'
    )
    expect(
      seriesOfRow({ name: 'x', provider: 'LSE', organisation: 'Healthy, Thriving Communities' })
    ).toBeNull()
  })

  it('guesses which providers are people, only to report them', () => {
    expect(looksLikePerson('Dr Anastasiya Lopukhina')).toBe(true)
    expect(looksLikePerson('Maria Korochkina')).toBe(true)
    expect(looksLikePerson('Royal Holloway')).toBe(false)
    expect(looksLikePerson('DataCamp')).toBe(false)
    expect(looksLikePerson('')).toBe(false)
  })
})
