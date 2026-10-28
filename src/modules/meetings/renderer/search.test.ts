import { describe, expect, it } from 'vitest'
import type { MeetingIndexRow } from '../shared/types'
import { meetingHits } from './search'
import { plainRequest, searchRequest } from '@shared/search-query'

const meeting = (over: Partial<MeetingIndexRow>): MeetingIndexRow => ({
  workspace: 'research',
  id: '2025-10-14 Supervision',
  uid: '',
  task: '',
  series: 'Supervision',
  date: '2025-10-14',
  start: null,
  end: null,
  mode: null,
  attendees: [],
  skills: [],
  summary: 'Key topics: the data sharing agreement.',
  excerpt: 'Ethics application for Study 1 and the data management plan.',
  problems: [],
  topicCount: 0,
  hasNotes: false,
  todos: [],
  contentHash: 'h',
  ...over
})

describe('meetingHits', () => {
  const rows = [
    meeting({}),
    meeting({ id: '2025-11-11 Rastle Lab', series: 'Rastle Lab', date: '2025-11-11' })
  ]

  it('finds a meeting by series and describes it by its summary', () => {
    const hits = meetingHits(rows, [], plainRequest('rastle'))
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({
      title: 'Rastle Lab · Nov 11, 2025',
      route: '/research/meetings/m/2025-11-11%20Rastle%20Lab'
    })
  })

  it('finds a meeting by its notes and shows the part that matched', () => {
    const hits = meetingHits(rows, [], plainRequest('ethics'))
    expect(hits[0].detail).toContain('Ethics application')
  })

  it('finds nothing for a word that is not there', () => {
    expect(meetingHits(rows, [], plainRequest('zebra'))).toEqual([])
  })
})

describe('meetingHits with modifiers', () => {
  const today = '2026-10-19'
  const rows = [
    meeting({
      id: 'a',
      series: 'Supervision',
      date: '2026-05-03',
      attendees: ['Chris Cummiskey'],
      skills: ['Writing'],
      summary: 'Key topics: x.',
      todos: [{ kind: 'inline', owners: [], text: 'Do it', done: false, line: 0 }]
    }),
    meeting({
      id: 'b',
      series: 'Luminos',
      date: '2026-10-10',
      attendees: ['Kathy Rastle'],
      summary: '',
      todos: [{ kind: 'inline', owners: [], text: 'Done', done: true, line: 0 }]
    }),
    meeting({ id: 'c', series: 'Luminos', date: '', attendees: [], summary: '' })
  ]
  const run = (query: string): string[] =>
    meetingHits(rows, [], searchRequest(query, today), 40).map((h) => h.key)

  it('with: an attendee by full name', () => {
    expect(run('with:"chris cummiskey"')).toEqual(['a'])
    expect(run('-with:"chris cummiskey"').sort()).toEqual(['b', 'c'])
  })

  it('series: and skill:', () => {
    expect(run('series:luminos').sort()).toEqual(['b', 'c'])
    expect(run('skill:writing')).toEqual(['a'])
    expect(run('-skill:writing').sort()).toEqual(['b', 'c'])
    expect(run('series:"rastle lab"')).toEqual([])
  })

  it('has:todos is an open TODO, has:summary a written summary', () => {
    expect(run('has:todos')).toEqual(['a'])
    expect(run('-has:todos').sort()).toEqual(['b', 'c'])
    expect(run('has:summary')).toEqual(['a'])
  })

  it('dates; a planned meeting with no date matches no positive date modifier', () => {
    expect(run('after:2026-06')).toEqual(['b'])
    expect(run('before:2026-06')).toEqual(['a'])
    expect(run('on:2026-10')).toEqual(['b'])
    expect(run('during:"this month"')).toEqual(['b'])
    expect(run('-on:2026-10').sort()).toEqual(['a', 'c'])
    expect(run('after:2000')).not.toContain('c')
  })

  it('ANDs different modifiers', () => {
    expect(run('series:luminos with:"kathy rastle"')).toEqual(['b'])
    expect(run('series:supervision with:"kathy rastle"')).toEqual([])
  })
})
