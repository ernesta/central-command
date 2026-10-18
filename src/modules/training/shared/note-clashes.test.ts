import { describe, expect, it } from 'vitest'
import type { MeetingIndexRow } from '../../meetings/shared/types'
import { noteSpans, notesOverlapping } from './note-clashes'
import type { TrainingIndexRow } from './types'

const training = (over: Partial<TrainingIndexRow> = {}): TrainingIndexRow =>
  ({
    workspace: 'research',
    id: '2026-10-20 A',
    date: '2026-10-20',
    start: '09:00',
    end: '10:00',
    title: 'A',
    series: null,
    task: '',
    ...over
  }) as TrainingIndexRow
const meeting = (over: Partial<MeetingIndexRow> = {}): MeetingIndexRow =>
  ({
    workspace: 'research',
    id: '2026-10-20 Supervision',
    series: 'Supervision',
    task: '',
    date: '2026-10-20',
    start: '09:30',
    end: '10:30',
    ...over
  }) as MeetingIndexRow
const self = (
  id: string,
  kind: 'meeting' | 'training' = 'training'
): { kind: 'meeting' | 'training'; workspace: 'research'; id: string } => ({
  kind,
  workspace: 'research' as const,
  id
})
const clash = (
  spans: ReturnType<typeof noteSpans>,
  id: string,
  date: string,
  start: string,
  end: string,
  kind: 'meeting' | 'training' = 'training'
): string[] => notesOverlapping(spans, self(id, kind), date, start, end).map((o) => o.label)

describe('notesOverlapping', () => {
  it('finds two trainings that overlap with no task or series, on an upcoming date', () => {
    const spans = noteSpans(
      [],
      [training(), training({ id: '2026-10-20 B', title: 'B', start: '09:30', end: '11:00' })]
    )
    expect(clash(spans, '2026-10-20 A', '2026-10-20', '09:00', '10:00')).toEqual(['B'])
    expect(clash(spans, '2026-10-20 B', '2026-10-20', '09:30', '11:00')).toEqual(['A'])
  })

  it('does not count touching times', () => {
    const spans = noteSpans([], [training({ start: '10:00', end: '11:00' })])
    expect(clash(spans, 'other', '2026-10-20', '09:00', '10:00')).toEqual([])
    expect(clash(spans, 'other', '2026-10-20', '11:00', '12:00')).toEqual([])
    expect(clash(spans, 'other', '2026-10-20', '10:59', '12:00')).toEqual(['A'])
  })

  it('never compares a note with itself, but a meeting and a training of one name are two', () => {
    const spans = noteSpans(
      [meeting({ id: 'same', series: 'M' })],
      [training({ id: 'same', title: 'T' })]
    )
    expect(clash(spans, 'same', '2026-10-20', '09:00', '10:00')).toEqual(['M'])
    expect(clash(spans, 'same', '2026-10-20', '09:30', '10:30', 'meeting')).toEqual(['T'])
  })

  it('does not count the entry under a name it had a moment ago (a rename leaves both in the index)', () => {
    const spans = noteSpans(
      [],
      [
        training({ id: '2026-10-20 A' }),
        training({ id: '2026-10-20 B', title: 'B' }),
        training({ id: '2026-10-20 C', title: 'C' })
      ]
    )
    const found = notesOverlapping(
      spans,
      { ...self('2026-10-20 B'), renamedFrom: ['2026-10-20 A'] },
      '2026-10-20',
      '09:00',
      '10:00'
    )
    expect(found.map((o) => o.label)).toEqual(['C'])
  })

  it('finds a training against a meeting without a task, and the reverse', () => {
    const spans = noteSpans([meeting()], [training()])
    expect(clash(spans, '2026-10-20 A', '2026-10-20', '09:00', '10:00')).toEqual(['Supervision'])
    expect(
      clash(spans, '2026-10-20 Supervision', '2026-10-20', '09:30', '10:30', 'meeting')
    ).toEqual(['A'])
  })

  it('looks only at the same date and workspace', () => {
    const spans = noteSpans(
      [meeting({ workspace: 'work' })],
      [training({ date: '2026-10-21' }), training({ id: 'life', workspace: 'life' })]
    )
    expect(clash(spans, 'x', '2026-10-20', '09:00', '10:00')).toEqual([])
  })

  it('leaves out notes without a date or both times, and says nothing for a note without them', () => {
    const spans = noteSpans(
      [],
      [
        training({ end: null }),
        training({ start: null }),
        training({ date: '' }),
        training({ id: 'ok', title: 'ok' })
      ]
    )
    expect(spans).toHaveLength(1)
    expect(clash(spans, 'x', '2026-10-20', '09:00', null as unknown as string)).toEqual([])
    expect(notesOverlapping(spans, self('x'), '2026-10-20', null, '10:00')).toEqual([])
    expect(notesOverlapping(spans, self('x'), '2026-10-20', '10:00', '09:00')).toEqual([])
  })

  it('labels a lecture with its series', () => {
    const spans = noteSpans([], [training({ series: 'PS5210', title: 'fNIRS' })])
    expect(clash(spans, 'x', '2026-10-20', '09:00', '10:00')).toEqual(['PS5210: fNIRS'])
  })
})
