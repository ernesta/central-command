import { describe, expect, it } from 'vitest'
import { lectureEntries, lectureTaskUid } from './lecture-entries'
import type { TrainingIndexRow } from './types'

const row = (over: Partial<TrainingIndexRow> = {}): TrainingIndexRow => ({
  workspace: 'research',
  id: '2026-10-06 Plotly',
  date: '2026-10-06',
  start: '10:00',
  end: '11:30',
  title: 'Plotly',
  series: 'Intro to Python',
  type: null,
  mode: null,
  skills: [],
  leads: [],
  institution: null,
  folder: null,
  task: 'k1',
  summary: '',
  excerpt: '',
  hasNotes: false,
  problems: [],
  contentHash: 'h',
  ...over
})
const tasks = (uid: string): { title: string } | null =>
  uid === 'k1' ? { title: ' Session 3: Plotly ' } : null

describe('lectureEntries', () => {
  it('derives one entry from the note, with the task and its title, as a training', () => {
    expect(lectureEntries([row()], tasks, '2026-10-07')).toEqual([
      {
        kind: 'training',
        id: '2026-10-06 Plotly',
        date: '2026-10-06',
        start: '10:00',
        end: '11:30',
        task: 'cc://task/k1',
        label: 'Intro to Python: Session 3: Plotly'
      }
    ])
  })

  it('labels a lecture without a series by its title alone', () => {
    expect(lectureEntries([row({ series: null })], tasks, '2026-10-07')[0].label).toBe(
      'Session 3: Plotly'
    )
  })

  it('gives nothing to an older note, a marked note without a subtask, or a task that is gone', () => {
    expect(lectureEntries([row({ task: '' })], tasks, '2026-10-07')).toEqual([])
    expect(lectureEntries([row({ task: 'auto' })], tasks, '2026-10-07')).toEqual([])
    expect(lectureEntries([row({ task: 'gone' })], tasks, '2026-10-07')).toEqual([])
  })

  it('gives nothing without both times, with the end not after the start, without a date, or in the future', () => {
    expect(lectureEntries([row({ end: null })], tasks, '2026-10-07')).toEqual([])
    expect(lectureEntries([row({ start: null })], tasks, '2026-10-07')).toEqual([])
    expect(lectureEntries([row({ start: '11:30', end: '10:00' })], tasks, '2026-10-07')).toEqual([])
    expect(lectureEntries([row({ start: '10:00', end: '10:00' })], tasks, '2026-10-07')).toEqual([])
    expect(lectureEntries([row({ date: '' })], tasks, '2026-10-07')).toEqual([])
    expect(lectureEntries([row({ date: '2026-10-08' })], tasks, '2026-10-07')).toEqual([])
    expect(lectureEntries([row({ date: '2026-10-07' })], tasks, '2026-10-07')).toHaveLength(1)
  })
})

describe('lectureTaskUid', () => {
  it('is the uid, and nothing for no task or the marker', () => {
    expect(lectureTaskUid('k1')).toBe('k1')
    expect(lectureTaskUid('')).toBeNull()
    expect(lectureTaskUid('auto')).toBeNull()
  })
})
