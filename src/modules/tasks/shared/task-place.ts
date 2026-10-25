import { listLabel } from './query'
import { STUDY_LINE } from './study-label'
import type { Task } from './types'

/**
 * Where a task sits, as every task line says it: `Impact › Historical Data Analysis` (a subtask has no list of its own and
 * shows its parent's); a self-study task, shown as a training, says "Training · self-study". The one version: Hours' rows, the
 * timer's picker and popover, search and the `@` picker all call it.
 */
export function detailOfTask(task: Task, all: readonly Task[]): string {
  if (task.ownKind === 'self-study') return STUDY_LINE
  const home = task.list || !task.parentUid ? task : all.find((t) => t.uid === task.parentUid)
  return home ? listLabel(home.list, home.sublist) : ''
}
