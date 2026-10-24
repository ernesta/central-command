import { trainingLabel } from '../../training/shared/training-entries'
import type { Task } from './types'

const SERIES_SUFFIX = /\s*·?\s*self-study$/i

/** The second line of a self-study task wherever a list would be: it is shown as a training, so it names no list. */
export const STUDY_LINE = 'Training · self-study'

/**
 * The name a self-study task is shown by (the user's rule, 24 Oct 2026): its training's name as the Training module gives it,
 * "Series: Title", or just "Title" for a training with no series or one that already starts with its series. `series` is the
 * series task's title (`<series> self-study`); with none (a series-less training keeps `<title> self-study`) the title alone. A
 * display rule only: the stored titles do not change.
 */
export function studyNameOf(title: string, parentTitle: string | null): string {
  const series = parentTitle ? parentTitle.replace(SERIES_SUFFIX, '').trim() : ''
  const name = (parentTitle ? title : title.replace(SERIES_SUFFIX, '')).trim()
  return trainingLabel(series === '' ? null : series, name || 'Untitled')
}

/** A self-study task's display name, or null for any other task. */
export function studyName(task: Task, parent: Task | undefined): string | null {
  return task.ownKind === 'self-study' ? studyNameOf(task.title, parent?.title ?? null) : null
}

/** A task's name as one line of text: a self-study task's training name, else its title ("Untitled" when empty). */
export function taskLabel(task: Task, parent: Task | undefined): string {
  return studyName(task, parent) ?? (task.title || 'Untitled')
}

/**
 * The title the `↳ parent · list` line names for a task, or null where the line has no parent: a top-level task, and a self-study
 * subtask (its series is already in its name).
 */
export function subtaskParent(task: Task, all: readonly Task[]): string | null {
  if (!task.parentUid || task.ownKind === 'self-study') return null
  return parentIn(task, all)?.title ?? null
}

/** The parent of a task among `tasks` (undefined for a top-level one). */
export function parentIn(task: Task, tasks: readonly Task[]): Task | undefined {
  return task.parentUid ? tasks.find((t) => t.uid === task.parentUid) : undefined
}
