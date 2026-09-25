import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MEETINGS_QUERY,
  attendeeNames,
  formatTimeRange,
  initialsFor,
  isUpcoming,
  normaliseMeetingsQuery,
  reconcileQuery,
  queryMeetings,
  seriesOptions,
  upcomingMeetings,
  type MeetingsQuery
} from './query'
import type { MeetingIndexRow, Person } from './types'

const row = (id: string, over: Partial<MeetingIndexRow> = {}): MeetingIndexRow => ({
  workspace: 'research',
  id,
  series: 'Supervision',
  date: id.slice(0, 10),
  start: null,
  end: null,
  mode: null,
  attendees: [],
  skills: [],
  summary: '',
  excerpt: '',
  problems: [],
  topicCount: 0,
  todos: [],
  contentHash: 'h',
  ...over
})
const q = (over: Partial<MeetingsQuery> = {}): MeetingsQuery => ({
  ...DEFAULT_MEETINGS_QUERY,
  ...over
})
const ids = (rows: MeetingIndexRow[]): string[] => rows.map((r) => r.id)
const TODAY = '2026-09-24'
const people: Person[] = [
  { name: 'Kathy Rastle', initials: 'KR', me: false },
  { name: 'Ernesta Orlovaitė', initials: 'EO', me: true }
]

describe('queryMeetings: what is listed and in what order', () => {
  const rows = [
    row('2026-09-10 Supervision'),
    row('2026-09-24 Supervision', { start: '10:00' }),
    row('2026-09-24 Rastle Lab', { series: 'Rastle Lab', start: '14:00' }),
    row('2026-09-24 Other', { series: 'Other' }),
    row('2026-10-01 Supervision'),
    row('undated', { date: '' })
  ]

  it('is newest first (upcoming meetings first), later start first within a day, no start last, undated at the end', () => {
    expect(ids(queryMeetings(rows, q(), people))).toEqual([
      '2026-10-01 Supervision',
      '2026-09-24 Rastle Lab',
      '2026-09-24 Supervision',
      '2026-09-24 Other',
      '2026-09-10 Supervision',
      'undated'
    ])
  })

  it('includes upcoming meetings, which the list marks using isUpcoming', () => {
    expect(ids(queryMeetings(rows, q(), people))).toContain('2026-10-01 Supervision')
    expect(isUpcoming(rows[4], TODAY)).toBe(true)
    expect(isUpcoming(rows[3], TODAY)).toBe(false) // today is not upcoming
  })

  it('never hides a meeting whose date could not be read', () => {
    expect(ids(queryMeetings([row('undated', { date: '' })], q(), people))).toEqual(['undated'])
    expect(isUpcoming({ date: '' }, TODAY)).toBe(false)
  })

  it('does not change the rows it is given', () => {
    const copy = [...rows]
    queryMeetings(rows, q(), people)
    expect(rows).toEqual(copy)
  })
})

describe('queryMeetings: filters', () => {
  const rows = [
    row('2026-09-10 Supervision', {
      mode: 'online',
      attendees: ['Kathy Rastle', 'Ernesta Orlovaitė']
    }),
    row('2026-09-11 Rastle Lab', {
      series: 'Rastle Lab',
      mode: 'in-person',
      attendees: ['Kathy Rastle']
    }),
    row('2026-09-12 Luminos', { series: 'Luminos', attendees: ['Matthew Jukes'] })
  ]

  it('filters by series, type and attendee, and they combine', () => {
    expect(ids(queryMeetings(rows, q({ series: 'Rastle Lab' }), people))).toEqual([
      '2026-09-11 Rastle Lab'
    ])
    expect(ids(queryMeetings(rows, q({ mode: 'online' }), people))).toEqual([
      '2026-09-10 Supervision'
    ])
    expect(ids(queryMeetings(rows, q({ attendee: 'Kathy Rastle' }), people))).toEqual([
      '2026-09-11 Rastle Lab',
      '2026-09-10 Supervision'
    ])
    expect(
      ids(queryMeetings(rows, q({ attendee: 'Kathy Rastle', mode: 'in-person' }), people))
    ).toEqual(['2026-09-11 Rastle Lab'])
  })

  it('a meeting with no type is not matched by a type filter', () => {
    expect(ids(queryMeetings(rows, q({ mode: 'in-person' }), people))).not.toContain(
      '2026-09-12 Luminos'
    )
  })
})

describe('queryMeetings: search', () => {
  const rows = [
    row('2026-09-10 Supervision', {
      attendees: ['Kathy Rastle', 'Ernesta Orlovaitė'],
      summary: 'Discussed the Müller weighting problem.',
      excerpt: 'Discussed the Müller weighting problem. Ethics application timeline.',
      mode: 'in-person'
    }),
    row('2026-03-02 Luminos', {
      series: 'Luminos',
      attendees: ['Matthew Jukes'],
      summary: 'Pilot timeline.'
    })
  ]
  const find = (search: string): string[] => ids(queryMeetings(rows, q({ search }), people))

  it('finds by series, attendee name or initials, summary and note text', () => {
    expect(find('luminos')).toEqual(['2026-03-02 Luminos'])
    expect(find('jukes')).toEqual(['2026-03-02 Luminos'])
    expect(find('EO')).toEqual(['2026-09-10 Supervision'])
    expect(find('ethics')).toEqual(['2026-09-10 Supervision'])
    expect(find('pilot')).toEqual(['2026-03-02 Luminos'])
  })
  it('ignores case and accents', () => {
    expect(find('MULLER')).toEqual(['2026-09-10 Supervision'])
    expect(find('orlovaite')).toEqual(['2026-09-10 Supervision'])
  })
  it('finds by date in either form, and by type', () => {
    expect(find('2026-09')).toEqual(['2026-09-10 Supervision'])
    expect(find('sep 10')).toEqual(['2026-09-10 Supervision'])
    expect(find('in person')).toEqual(['2026-09-10 Supervision'])
  })
  it('needs every word to match, in any order', () => {
    expect(find('timeline ethics')).toEqual(['2026-09-10 Supervision'])
    expect(find('timeline nothing')).toEqual([])
  })
  it('blank search matches everything', () => {
    expect(find('   ')).toHaveLength(2)
  })
  it('uses derived initials for attendees not in the people list', () => {
    expect(find('MJ')).toEqual(['2026-03-02 Luminos'])
    expect(initialsFor('Matthew Jukes', people)).toBe('MJ')
    expect(initialsFor('Kathy Rastle', people)).toBe('KR')
  })
})

describe('helpers', () => {
  it('upcomingMeetings lists the future ones, soonest first', () => {
    const rows = [row('2026-11-01 Other'), row('2026-10-01 Other'), row('2026-09-01 Other')]
    expect(ids(upcomingMeetings(rows, TODAY))).toEqual(['2026-10-01 Other', '2026-11-01 Other'])
  })
  it('seriesOptions is the fixed list plus any other series in the files', () => {
    expect(
      seriesOptions([row('a', { series: 'Book Club' }), row('b', { series: 'Other' })])
    ).toEqual(['Supervision', 'Rastle Lab', 'Luminos', 'Other', 'Book Club'])
  })
  it('attendeeNames is everyone once, alphabetically', () => {
    expect(
      attendeeNames([row('a', { attendees: ['B B', 'A A'] }), row('b', { attendees: ['A A'] })])
    ).toEqual(['A A', 'B B'])
  })
  it('formatTimeRange', () => {
    expect(formatTimeRange('14:00', '15:00')).toBe('14:00–15:00')
    expect(formatTimeRange('14:00', null)).toBe('14:00')
    expect(formatTimeRange(null, null)).toBe('—')
    expect(formatTimeRange(null, '15:00')).toBe('—')
  })
})

describe('remembered query', () => {
  it('keeps a valid saved query as it is', () => {
    const saved = {
      search: 'ethics',
      series: 'Supervision',
      attendee: 'Kathy Rastle',
      mode: 'online' as const
    }
    expect(normaliseMeetingsQuery(saved)).toEqual(saved)
  })
  it('falls back to the defaults for anything else', () => {
    for (const raw of [
      undefined,
      null,
      'x',
      7,
      [],
      {},
      { search: 5, series: '', attendee: null, mode: 'hybrid' }
    ]) {
      expect(normaliseMeetingsQuery(raw)).toEqual(DEFAULT_MEETINGS_QUERY)
    }
  })
  it('sets a series or attendee that is no longer in the files back to "all", and keeps the rest', () => {
    const saved = {
      search: 'x',
      series: 'Book Club',
      attendee: 'Gone Person',
      mode: 'online' as const
    }
    expect(reconcileQuery(saved, ['Supervision'], ['Kathy Rastle'])).toEqual({
      search: 'x',
      series: 'all',
      attendee: 'all',
      mode: 'online'
    })
    expect(
      reconcileQuery(
        { ...saved, series: 'Supervision', attendee: 'Kathy Rastle' },
        ['Supervision'],
        ['Kathy Rastle']
      )
    ).toMatchObject({
      series: 'Supervision',
      attendee: 'Kathy Rastle'
    })
  })
})
