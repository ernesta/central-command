import { timeToSeconds } from '@shared/tracking/rounding'
import type { Session } from '@shared/tracking/types'
import { fold } from '@shared/text'
import { durationMinutes } from './time'
import type { MeetingIndexRow, MeetingWorkspace } from './types'

/**
 * A meeting's hours as the Hours page sees them. Worked out from the note's date, start and end every time they are asked for
 * and never stored anywhere: change the note and the entry follows.
 */
export interface MeetingEntry {
  workspace: MeetingWorkspace
  /** The meeting (its file's base name). */
  id: string
  date: string
  /** HH:MM */
  start: string
  end: string
  /** The exact length in minutes. */
  minutes: number
  /** The task's key (`cc://task/<uid>`) and its title. */
  task: string
  label: string
  /** Work: the client the task's list stands for. */
  client?: string
}

/** What the entries need to know of a task. */
export interface TaskInfo {
  title: string
  list: string
}

const TASK_PREFIX = 'cc://task/'

/**
 * One entry per meeting that has a task, a date that is not after today, and both times (the end after the start). A note
 * with no times, no task, no date or a task that is gone has no entry: nothing is guessed. `clients` (Work) turns the task's
 * list into the client, in the client's own spelling; with none given (Research) there is no client.
 */
export function meetingEntries(
  rows: readonly MeetingIndexRow[],
  taskOf: (uid: string) => TaskInfo | null,
  today: string,
  clients: readonly string[] | null = null
): MeetingEntry[] {
  const entries: MeetingEntry[] = []
  for (const row of rows) {
    if (!row.task || !row.date || row.date > today) continue
    const minutes = durationMinutes(row.start, row.end)
    if (minutes === null) continue
    const task = taskOf(row.task)
    if (!task) continue
    const client = clients?.find((c) => fold(c) === fold(task.list))
    entries.push({
      workspace: row.workspace,
      id: row.id,
      date: row.date,
      start: row.start ?? '',
      end: row.end ?? '',
      minutes,
      task: `${TASK_PREFIX}${row.task}`,
      label: task.title.trim(),
      ...(client !== undefined ? { client } : {})
    })
  }
  return entries
}

/** Something on the clock a meeting can overlap: a timer block, another meeting. Times are HH:MM or HH:MM:SS. */
export interface Occupied {
  label: string
  start: string
  /** Null while it runs: it then lasts until `now`. */
  end: string | null
  /** A meeting's id, so a meeting is never compared with itself. */
  meeting?: string
}

/**
 * Those of `others` whose time overlaps `[start, end)` (one that ends exactly when the other starts does not). A running block
 * lasts until `now` (seconds since midnight); one with a time that cannot be read is ignored. Pure: it only says, it never changes.
 */
export function overlapping(
  start: string | null,
  end: string | null,
  others: readonly Occupied[],
  now: number,
  self?: string
): Occupied[] {
  const a = start ? timeToSeconds(start) : null
  const b = end ? timeToSeconds(end) : null
  if (a === null || b === null || b <= a) return []
  return others.filter((o) => {
    if (self !== undefined && o.meeting === self) return false
    const s = timeToSeconds(o.start)
    // A timer that has only just started still occupies its start.
    const e =
      o.end === null && s !== null
        ? Math.max(now, s + 1)
        : o.end === null
          ? null
          : timeToSeconds(o.end)
    if (s === null || e === null || e <= s) return false
    return s < b && a < e
  })
}

/** What the timer and typed blocks of a day occupy, from their sessions (typed time has no clock time, so it cannot overlap). */
export function occupiedBySessions(sessions: readonly Session[], date: string): Occupied[] {
  return sessions
    .filter((s) => s.date === date && !s.derived)
    .map((s) => ({ label: s.label, start: s.start, end: s.end }))
}

/** The other meetings of a day, as things a meeting can overlap. */
export function occupiedByMeetings(
  entries: readonly Pick<MeetingEntry, 'id' | 'date' | 'start' | 'end' | 'label'>[],
  date: string,
  workspace: MeetingWorkspace
): Occupied[] {
  return entries
    .filter((e) => e.date === date)
    .map((e) => ({ label: e.label, start: e.start, end: e.end, meeting: `${workspace}/${e.id}` }))
}
