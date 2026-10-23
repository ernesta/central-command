import type { Task } from './types'

const SERIES_SUFFIX = /\s*·?\s*self-study$/i

/**
 * The series a self-study subtask belongs to ("Simulating Social Worlds" for "Day 2 self-study" under "Simulating Social Worlds
 * self-study"), or null for any other task. A display rule only (the user's, 23 Oct 2026): the data keeps its titles.
 */
export function studySeries(task: Task, parent: Task | undefined): string | null {
  if (task.ownKind !== 'self-study' || !parent) return null
  const series = parent.title.replace(SERIES_SUFFIX, '').trim()
  return series === '' ? null : series
}

/** A task's title as one line of text, a self-study subtask's with its series in front: "Simulating Social Worlds › Day 2 self-study". */
export function studyLabel(task: Task, parent: Task | undefined): string {
  const series = studySeries(task, parent)
  const title = task.title || 'Untitled'
  return series ? `${series} › ${title}` : title
}

/** The parent of a task among `tasks` (undefined for a top-level one). */
export function parentIn(task: Task, tasks: readonly Task[]): Task | undefined {
  return task.parentUid ? tasks.find((t) => t.uid === task.parentUid) : undefined
}
