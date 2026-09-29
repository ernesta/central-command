import { describe, expect, it } from 'vitest'
import type { MeetingIndexRow } from '../shared/types'
import { meetingHits } from './search'

const meeting = (over: Partial<MeetingIndexRow>): MeetingIndexRow => ({
  workspace: 'research',
  id: '2025-10-14 Supervision',
  uid: '',
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
    const hits = meetingHits(rows, [], 'rastle')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({
      title: 'Rastle Lab · Nov 11, 2025',
      route: '/research/meetings/m/2025-11-11%20Rastle%20Lab'
    })
  })

  it('finds a meeting by its notes and shows the part that matched', () => {
    const hits = meetingHits(rows, [], 'ethics')
    expect(hits[0].detail).toContain('Ethics application')
  })

  it('finds nothing for a word that is not there', () => {
    expect(meetingHits(rows, [], 'zebra')).toEqual([])
  })
})
