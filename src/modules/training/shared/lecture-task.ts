import { fold } from '@shared/text'
import type { Task } from '../../tasks/shared/types'

/** Research keeps its series tasks together in one list of its own. */
export const TRAINING_LIST = 'Training'

/** The series task a lecture sits under: one that exists, or the one to create. */
export type ParentTarget = { uid: string } | { title: string; list: string }

/** What a training note's task needs done now. Pure: it only says, the page does it. */
export type LecturePlan =
  | { kind: 'none' }
  /** A marked note with a series and no subtask yet: make the lecture's subtask under the series task. */
  | { kind: 'create'; title: string; parent: ParentTarget }
  /** The subtask follows the note: its title, and the series it sits under. */
  | { kind: 'sync'; uid: string; title?: string; parent?: ParentTarget }

export interface LectureNote {
  /** The note's `task:` value: a task uid, `auto` or ''. */
  task: string
  series: string | null
  title: string
}

/** An open top-level task called the series (in "Training" first, else any list), or the one to create. */
export function parentFor(series: string, tasks: readonly Task[]): ParentTarget {
  const name = series.trim()
  const same = tasks.filter(
    (t) => !t.parentUid && t.status !== 'done' && fold(t.title.trim()) === fold(name)
  )
  const found = same.find((t) => fold(t.list) === fold(TRAINING_LIST)) ?? same[0]
  return found ? { uid: found.uid } : { title: name, list: TRAINING_LIST }
}

/**
 * What a training note's lecture task needs.
 *
 * - An older note (`task` empty) is left alone, always.
 * - A marked note (`auto`) with no series yet waits; once it has one, its subtask is made under the series task.
 * - A note with a subtask keeps it in step: the subtask takes the note's title and sits under the task its series names. Clearing
 *   the series leaves it where it is. A task that is not a subtask (a plain task) is never renamed or moved, and a task that is
 *   gone is not made again by itself.
 *
 * `tasks` is every task of the workspace (subtasks too).
 */
export function planLectureTask(note: LectureNote, tasks: readonly Task[]): LecturePlan {
  const series = (note.series ?? '').trim()
  const title = note.title.trim()
  if (note.task === 'auto') {
    return series
      ? { kind: 'create', title: title || 'Untitled', parent: parentFor(series, tasks) }
      : { kind: 'none' }
  }
  if (!note.task) return { kind: 'none' }
  const own = tasks.find((t) => t.uid === note.task)
  if (!own || !own.parentUid) return { kind: 'none' }
  const parent = tasks.find((t) => t.uid === own.parentUid)
  const plan: { kind: 'sync'; uid: string; title?: string; parent?: ParentTarget } = {
    kind: 'sync',
    uid: own.uid
  }
  if (title && title !== own.title) plan.title = title
  if (series && fold(series) !== fold((parent?.title ?? '').trim())) {
    plan.parent = parentFor(series, tasks)
  }
  return plan.title === undefined && plan.parent === undefined ? { kind: 'none' } : plan
}

/**
 * A series task this note's page made a moment ago (while the series was still being typed) that the lecture has now left, with
 * nothing else in it: the one to put in the trash. Only a task in `made` is ever named, so a task the user made is never touched,
 * and the trash is restorable. `tasks` is every live task of the workspace.
 */
export function strandedParent(
  made: ReadonlySet<string>,
  left: string | null,
  tasks: readonly Task[]
): string | null {
  if (!left || !made.has(left)) return null
  return tasks.some((t) => t.parentUid === left) ? null : left
}
