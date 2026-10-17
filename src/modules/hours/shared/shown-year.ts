import { withDerived, type DerivedEntry } from '@shared/tracking/derived'
import type { TrackingYear } from '@shared/tracking/types'
import { meetingEntries, type TaskInfo } from '../../meetings/shared/meeting-entries'
import type { MeetingIndexRow } from '../../meetings/shared/types'
import { lectureEntries } from '../../training/shared/lecture-entries'
import type { TrainingIndexRow } from '../../training/shared/types'
import type { Task } from '../../tasks/shared/types'

/** What the hours the notes derive are worked out from: a workspace's notes and tasks (and Work's clients). */
export interface DerivedSources {
  meetings: readonly MeetingIndexRow[]
  /** Research's training notes; none in the other workspaces. */
  lectures: readonly TrainingIndexRow[]
  /** Every task of the workspace, subtasks too. */
  tasks: readonly Task[]
  /** Work's clients (its task lists); null where a workspace has none (Research). */
  clients: readonly string[] | null
  /** YYYY-MM-DD: a note dated after it has not happened yet. */
  today: string
}

/**
 * The hours the notes derive (`meetingEntries`, and a lecture's own session, `lectureEntries`), the same everywhere hours are
 * counted: the Hours page, Home, the main process's Home summary. Nothing is stored: this is the notes' date, start and end every time.
 */
export function derivedEntries(sources: DerivedSources): DerivedEntry[] {
  const byUid = new Map(sources.tasks.map((t) => [t.uid, t]))
  const taskOf = (uid: string): TaskInfo | null => {
    const task = byUid.get(uid)
    if (!task) return null
    // A subtask sits in its parent's list.
    const list = task.list || (task.parentUid ? (byUid.get(task.parentUid)?.list ?? '') : '')
    return { title: task.title, list }
  }
  return [
    ...meetingEntries(sources.meetings, taskOf, sources.today, sources.clients),
    ...lectureEntries(sources.lectures, taskOf, sources.today)
  ]
}

/**
 * The year as it is shown: its stored sessions and typed entries plus the hours the notes derive, and without a derived entry a stored
 * one already covers (`withDerived`). Every place that counts hours reads this, not the stored year.
 */
export function shownYear(year: TrackingYear, sources: DerivedSources): TrackingYear {
  return withDerived(year, derivedEntries(sources))
}
