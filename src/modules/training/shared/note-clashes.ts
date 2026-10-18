import type { DerivedKind } from '@shared/tracking/types'
import { noteKey, overlapping, type Occupied } from '../../meetings/shared/meeting-entries'
import type { MeetingIndexRow } from '../../meetings/shared/types'
import type { HoursWorkspace } from '../../hours/shared/workspaces'
import { lectureLabel } from './lecture-entries'
import type { TrainingIndexRow } from './types'

/** A meeting or training note on the clock: needs a date and both times, nothing else (no task, no series, any date). */
export interface NoteSpan {
  kind: DerivedKind
  workspace: HoursWorkspace
  id: string
  date: string
  /** HH:MM */
  start: string
  end: string
  label: string
}

/** One span per note that has a date, a start and an end; the rest are left out. Overlaps are the page's business, see `notesOverlapping`. */
export function noteSpans(
  meetings: readonly MeetingIndexRow[],
  trainings: readonly TrainingIndexRow[]
): NoteSpan[] {
  const spans: NoteSpan[] = []
  for (const m of meetings) {
    if (m.date && m.start && m.end) {
      spans.push({
        kind: 'meeting',
        workspace: m.workspace,
        id: m.id,
        date: m.date,
        start: m.start,
        end: m.end,
        label: m.series
      })
    }
  }
  for (const t of trainings) {
    if (t.date && t.start && t.end) {
      spans.push({
        kind: 'training',
        workspace: t.workspace,
        id: t.id,
        date: t.date,
        start: t.start,
        end: t.end,
        label: lectureLabel(t.series, t.title || 'Untitled')
      })
    }
  }
  return spans
}

/**
 * The other notes of the same workspace and date whose `[start, end)` overlaps the given note's (touching times do not). The note
 * itself is never in the answer; a meeting and a training entry of one name are two notes.
 */
export function notesOverlapping(
  spans: readonly NoteSpan[],
  self: {
    kind: DerivedKind
    workspace: HoursWorkspace
    id: string
    renamedFrom?: readonly string[]
  },
  date: string,
  start: string | null,
  end: string | null
): Occupied[] {
  // A rename is a new file and a deleted one, seen one after the other: for a moment the index holds the note under both names.
  const own = new Set([self.id, ...(self.renamedFrom ?? [])])
  const others: Occupied[] = spans
    .filter(
      (s) =>
        s.date === date &&
        s.workspace === self.workspace &&
        !(s.kind === self.kind && own.has(s.id))
    )
    .map((s) => ({
      label: s.label,
      start: s.start,
      end: s.end,
      meeting: noteKey(s.kind, s.workspace, s.id)
    }))
  return overlapping(start, end, others, 0, noteKey(self.kind, self.workspace, self.id))
}
