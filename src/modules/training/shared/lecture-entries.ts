import { durationMinutes } from '@shared/time'
import type { DerivedEntry } from '@shared/tracking/derived'
import type { TrainingIndexRow } from './types'

/** What the entries need to know of a task. */
export interface LectureTaskInfo {
  title: string
}

const TASK_PREFIX = 'cc://task/'

/** A note's `task:` value as a task uid, or null for no task and for `auto` (a note that has no subtask yet). */
export function lectureTaskUid(task: string): string | null {
  return task && task !== 'auto' ? task : null
}

/** "Series: lecture" for a lecture in a series, the lecture alone otherwise. */
function lectureLabel(series: string | null, title: string): string {
  const name = title.trim()
  const programme = series?.trim()
  return programme && name !== programme ? `${programme}: ${name}` : name
}

/**
 * A lecture's own session as the Hours page sees it: one entry per training note that has a task (one that still exists), a date
 * that is not after today, and both times (the end after the start). Worked out from the note every time and never stored. A note
 * with no times, no date or no task has none; nothing is guessed, and an older note (no task) is never given hours.
 */
export function lectureEntries(
  rows: readonly TrainingIndexRow[],
  taskOf: (uid: string) => LectureTaskInfo | null,
  today: string
): DerivedEntry[] {
  const entries: DerivedEntry[] = []
  for (const row of rows) {
    const uid = lectureTaskUid(row.task)
    if (!uid || !row.date || row.date > today) continue
    if (durationMinutes(row.start, row.end) === null) continue
    const task = taskOf(uid)
    if (!task) continue
    entries.push({
      kind: 'training',
      id: row.id,
      date: row.date,
      start: row.start ?? '',
      end: row.end ?? '',
      task: `${TASK_PREFIX}${uid}`,
      label: lectureLabel(row.series, task.title)
    })
  }
  return entries
}
