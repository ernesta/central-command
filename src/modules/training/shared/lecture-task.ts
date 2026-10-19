import { fold } from '@shared/text'
import type { Task } from '../../tasks/shared/types'

/** Research keeps its series tasks together in one list of its own. */
export const TRAINING_LIST = 'Training'

const COMPLETE = 'Complete '

/** A task's name without a "Complete " prefix: an older ClickUp "Complete <course>" task still matches its series. */
export const bareTitle = (title: string): string => {
  const trimmed = title.trim()
  return fold(trimmed).startsWith(fold(COMPLETE)) ? trimmed.slice(COMPLETE.length).trim() : trimmed
}

/** The series task a lecture sits under: one that exists, or the one to create. */
export type ParentTarget = { uid: string } | { title: string; list: string }

/** What a training note's task needs done now. Pure: it only says, the page does it. */
export type LecturePlan =
  | { kind: 'none' }
  /** A marked note with no task yet: make it, under the series task, or on its own (`parent: null`) in Training. */
  | { kind: 'create'; title: string; parent: ParentTarget | null; due?: string }
  /** The task follows the note: its title, and where it sits (under the series task, or `parent: null` for top level in Training). */
  | { kind: 'sync'; uid: string; title?: string; parent?: ParentTarget | null; due?: string }

export interface LectureNote {
  /** The note's `task:` value: a task uid, `auto` or ''. */
  task: string
  series: string | null
  title: string
  /** YYYY-MM-DD, or '' while the note has none: the task is due that day. */
  date?: string
}

/** An open top-level task called the series (in "Training" first, else any list), or the one to create. */
export function parentFor(series: string, tasks: readonly Task[]): ParentTarget {
  const name = series.trim()
  const same = tasks.filter(
    (t) => !t.parentUid && t.status !== 'done' && fold(bareTitle(t.title)) === fold(bareTitle(name))
  )
  const found = same.find((t) => fold(t.list) === fold(TRAINING_LIST)) ?? same[0]
  return found ? { uid: found.uid } : { title: name, list: TRAINING_LIST }
}

/** A title that names a lecture: not empty, not the placeholder. */
const named = (title: string): boolean => title !== '' && title !== 'Untitled'

/**
 * What a training note's lecture task needs. The task is always in step with the note, with no clicking:
 *
 * - An older note (`task` empty) is left alone, always.
 * - A marked note (`auto`) gets its task once it has a series (a subtask under the series task) or a title (a task of its own, top
 *   level in Training).
 * - The task takes the note's title, is a subtask under the task its series names, and is a task of its own while the note has no
 *   series: adding a series moves it under the series task, clearing it takes it back out.
 * - The task is due on the note's date, and follows it.
 * - A task that is not the lecture's own is never renamed or moved: a subtask is always the lecture's, a top-level task only when
 *   it is in Training with nothing under it. A task that is gone is not made again by itself.
 *
 * `tasks` is every task of the workspace (subtasks too).
 */
export function planLectureTask(note: LectureNote, tasks: readonly Task[]): LecturePlan {
  const series = (note.series ?? '').trim()
  const title = note.title.trim()
  const due = note.date || undefined
  if (note.task === 'auto') {
    if (series) {
      return {
        kind: 'create',
        title: title || 'Untitled',
        parent: parentFor(series, tasks),
        ...(due ? { due } : {})
      }
    }
    return named(title)
      ? { kind: 'create', title: title, parent: null, ...(due ? { due } : {}) }
      : { kind: 'none' }
  }
  if (!note.task) return { kind: 'none' }
  const own = tasks.find((t) => t.uid === note.task)
  if (!own) return { kind: 'none' }
  const plan: {
    kind: 'sync'
    uid: string
    title?: string
    parent?: ParentTarget | null
    due?: string
  } = {
    kind: 'sync',
    uid: own.uid
  }
  if (title && title !== own.title && (own.parentUid || named(title))) plan.title = title
  if (own.parentUid) {
    const parent = tasks.find((t) => t.uid === own.parentUid)
    if (!series) plan.parent = null
    else if (fold(bareTitle(series)) !== fold(bareTitle(parent?.title ?? ''))) {
      plan.parent = parentFor(series, tasks)
    }
  } else {
    const ours =
      fold(own.list) === fold(TRAINING_LIST) && !tasks.some((t) => t.parentUid === own.uid)
    if (!ours) return { kind: 'none' }
    if (series) {
      plan.parent = parentFor(
        series,
        tasks.filter((t) => t.uid !== own.uid)
      )
    }
  }
  if (due && own.due !== due) plan.due = due
  return plan.title === undefined && plan.parent === undefined && plan.due === undefined
    ? { kind: 'none' }
    : plan
}

/**
 * Whether a task a training note's `task:` names is the lecture's own, so the app may date, close and hide it: marked `lecture`, a
 * subtask, or a top-level task in Training with nothing under it. Anything else is a task the user pointed the note at.
 */
export function isLectureOwn(own: Task, tasks: readonly Task[]): boolean {
  if (own.ownKind === 'lecture' || own.parentUid) return true
  return fold(own.list) === fold(TRAINING_LIST) && !tasks.some((t) => t.parentUid === own.uid)
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
