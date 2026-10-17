import { fold } from '@shared/text'
import type { Task } from '../../tasks/shared/types'
import { bareTitle, TRAINING_LIST, type ParentTarget } from './lecture-task'

const SUFFIX = ' · self-study'

/** The title of a self-study task: the series' own, or a lecture's (`<series> · self-study`, `<note title> · self-study`). */
export const selfStudyTitle = (name: string): string => `${name.trim()}${SUFFIX}`

/** What a training note's self-study task needs done now. Pure: it only says, the page does it. */
export type SelfStudyPlan =
  | { kind: 'none' }
  /** Make the lecture's self-study task, under the series' (found or made), or on its own (`parent: null`) in Training. */
  | { kind: 'create'; title: string; parent: ParentTarget | null }
  /** The task follows the note: its title, and where it sits (`parent: null` takes it out of the series for top level in Training). */
  | { kind: 'sync'; uid: string; title?: string; parent?: ParentTarget | null }

export interface SelfStudyNote {
  /** The note's `selfstudy:` value: a task uid or ''. */
  selfStudy: string
  series: string | null
  title: string
}

/** An open top-level task called `<series> · self-study` (in "Training" first, else any list), or the one to create. */
export function selfStudyParentFor(series: string, tasks: readonly Task[]): ParentTarget {
  const name = selfStudyTitle(series)
  const same = tasks.filter(
    (t) => !t.parentUid && t.status !== 'done' && fold(bareTitle(t.title)) === fold(bareTitle(name))
  )
  const found = same.find((t) => fold(t.list) === fold(TRAINING_LIST)) ?? same[0]
  return found ? { uid: found.uid } : { title: name, list: TRAINING_LIST }
}

/** A title that names a lecture: not empty, not the placeholder. */
const named = (title: string): boolean => title !== '' && title !== 'Untitled'

/** Whether a task is a series' self-study task: the parent a lecture's self-study subtask hangs under. */
const isSeriesTask = (t: Task | undefined): boolean =>
  !!t && !t.parentUid && fold(t.title).endsWith(fold(SUFFIX))

/**
 * What a training note's self-study task needs. Unlike the lecture task, nothing is made by itself: while `selfstudy` is empty the
 * plan is `none` until `asked` (Start or Add time was pressed), and a task that is gone is made again only when asked, silently.
 *
 * - The task is a subtask under the series' `<series> · self-study` task, and a task of its own (top level, in Training) while the note
 *   has no series; adding a series moves it under the series' task, clearing it takes it back out.
 * - The task takes the note's title (`<title> · self-study`), and has no due date.
 * - A task that is not the note's own is never renamed or moved: a subtask is the note's only under a self-study series task, and a
 *   top-level task only when it is in Training with nothing under it.
 *
 * `tasks` is every task of the workspace (subtasks too).
 */
export function planSelfStudyTask(
  note: SelfStudyNote,
  tasks: readonly Task[],
  asked = false
): SelfStudyPlan {
  const series = (note.series ?? '').trim()
  const title = note.title.trim()
  const own = note.selfStudy ? tasks.find((t) => t.uid === note.selfStudy) : undefined
  if (!own) {
    if (!asked) return { kind: 'none' }
    return {
      kind: 'create',
      title: selfStudyTitle(title || 'Untitled'),
      parent: series ? selfStudyParentFor(series, tasks) : null
    }
  }
  const plan: { kind: 'sync'; uid: string; title?: string; parent?: ParentTarget | null } = {
    kind: 'sync',
    uid: own.uid
  }
  const parent = own.parentUid ? tasks.find((t) => t.uid === own.parentUid) : undefined
  if (own.parentUid) {
    if (!isSeriesTask(parent)) return { kind: 'none' }
    if (!series) plan.parent = null
    else if (fold(bareTitle(parent?.title ?? '')) !== fold(selfStudyTitle(series))) {
      plan.parent = selfStudyParentFor(series, tasks)
    }
  } else {
    const ours =
      fold(own.list) === fold(TRAINING_LIST) && !tasks.some((t) => t.parentUid === own.uid)
    if (!ours) return { kind: 'none' }
    if (series) {
      plan.parent = selfStudyParentFor(
        series,
        tasks.filter((t) => t.uid !== own.uid)
      )
    }
  }
  if (named(title) || own.parentUid) {
    const wanted = selfStudyTitle(title || 'Untitled')
    if (title && own.title !== wanted) plan.title = wanted
  }
  return plan.title === undefined && plan.parent === undefined ? { kind: 'none' } : plan
}
