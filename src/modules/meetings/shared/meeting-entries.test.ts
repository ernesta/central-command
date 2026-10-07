import { describe, expect, it } from 'vitest'
import { meetingEntries, overlapping, occupiedBySessions, type TaskInfo } from './meeting-entries'
import type { MeetingIndexRow } from './types'

const row = (over: Partial<MeetingIndexRow> = {}): MeetingIndexRow => ({
  workspace: 'research',
  id: '2026-09-24 Supervision',
  uid: '',
  task: 'abc12345',
  series: 'Supervision',
  date: '2026-09-24',
  start: '14:00',
  end: '15:00',
  mode: null,
  attendees: [],
  skills: [],
  summary: '',
  excerpt: '',
  problems: [],
  topicCount: 0,
  todos: [],
  contentHash: '',
  ...over
})
const tasks: Record<string, TaskInfo> = {
  abc12345: { title: ' Supervision ', list: 'Meetings' },
  imp00001: { title: 'Impact meetings', list: 'impact' }
}
const taskOf = (uid: string): TaskInfo | null => tasks[uid] ?? null
const TODAY = '2026-10-07'

describe('meetingEntries', () => {
  it('derives the entry from the note: date, times, minutes, task title', () => {
    expect(meetingEntries([row()], taskOf, TODAY)).toEqual([
      {
        workspace: 'research',
        id: '2026-09-24 Supervision',
        date: '2026-09-24',
        start: '14:00',
        end: '15:00',
        minutes: 60,
        task: 'cc://task/abc12345',
        label: 'Supervision'
      }
    ])
  })

  it('follows an edited time (nothing is stored)', () => {
    expect(meetingEntries([row({ end: '15:30' })], taskOf, TODAY)[0].minutes).toBe(90)
  })

  it('gives no hours to a note with no task, a missing time, an end not after the start, no date, or a task that is gone', () => {
    const rows = [
      row({ id: 'no task', task: '' }),
      row({ id: 'no start', start: null }),
      row({ id: 'no end', end: null }),
      row({ id: 'backwards', start: '15:00', end: '14:00' }),
      row({ id: 'empty', start: '15:00', end: '15:00' }),
      row({ id: 'no date', date: '' }),
      row({ id: 'gone', task: 'deleted1' })
    ]
    expect(meetingEntries(rows, taskOf, TODAY)).toEqual([])
  })

  it('leaves out a meeting dated after today, and counts one dated today', () => {
    expect(meetingEntries([row({ date: '2026-10-08' })], taskOf, TODAY)).toEqual([])
    expect(meetingEntries([row({ date: TODAY })], taskOf, TODAY)).toHaveLength(1)
  })

  it('in Work takes the client from the task list in the client spelling', () => {
    const [entry] = meetingEntries([row({ workspace: 'work', task: 'imp00001' })], taskOf, TODAY, [
      'Impact',
      'Teaching & Learning'
    ])
    expect(entry.client).toBe('Impact')
    expect(entry.label).toBe('Impact meetings')
  })
})

describe('overlapping', () => {
  const others = [
    { label: 'Writing', start: '13:00:00', end: '14:30:00' },
    { label: 'Later', start: '15:00:00', end: '16:00:00' },
    { label: 'Before', start: '12:00:00', end: '14:00:00' }
  ]
  it('names what overlaps, and not what only touches', () => {
    expect(overlapping('14:00', '15:00', others, 0).map((o) => o.label)).toEqual(['Writing'])
  })
  it('counts a running block until now', () => {
    const running = [{ label: 'Now', start: '14:30:00', end: null }]
    expect(overlapping('14:00', '15:00', running, 14 * 3600 + 45 * 60)).toHaveLength(1)
    expect(overlapping('14:00', '14:30', running, 15 * 3600)).toHaveLength(0)
  })
  it('never compares a meeting with itself', () => {
    const me = [{ label: 'Me', start: '14:00', end: '15:00', meeting: 'research/a' }]
    expect(overlapping('14:00', '15:00', me, 0, 'research/a')).toEqual([])
    expect(overlapping('14:00', '15:00', me, 0, 'research/b')).toHaveLength(1)
  })
  it('says nothing for a meeting without both times', () => {
    expect(overlapping(null, '15:00', others, 0)).toEqual([])
    expect(overlapping('15:00', '14:00', others, 0)).toEqual([])
  })
  it('reads sessions of the day, ignoring derived ones and other days', () => {
    const sessions = [
      { id: '1', date: '2026-09-24', start: '14:10:00', end: '14:40:00', label: 'A' },
      { id: '2', date: '2026-09-25', start: '14:10:00', end: '14:40:00', label: 'B' },
      {
        id: '3',
        date: '2026-09-24',
        start: '14:10:00',
        end: '14:40:00',
        label: 'C',
        derived: { kind: 'meeting' as const, id: 'x' }
      }
    ]
    expect(occupiedBySessions(sessions, '2026-09-24').map((o) => o.label)).toEqual(['A'])
  })
})
