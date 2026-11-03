import { inYear } from '@shared/year'
import { isAllYears, type YearScope } from '@shared/year-scope'
import type { Task } from './types'
import { effectiveDue } from './views'

/**
 * Whether a task shows under Research's academic year filter (`docs/RESEARCH_YEAR_FILTER_PLAN.md`). Under All years, every task.
 * Under one year, by its due date (`effectiveDue`: its own, or the earliest of its open subtasks'):
 *
 * - due in the year: shown;
 * - no due date: always shown (it belongs to no year);
 * - open and due before the year began: shown, since it is still to do (a done one belongs to its own year);
 * - due after the year: not shown.
 */
export function taskInYearScope(task: Task, kids: readonly Task[], scope: YearScope): boolean {
  if (isAllYears(scope)) return true
  const due = effectiveDue(task, kids)
  if (due === null) return true
  if (inYear(due, scope)) return true
  return due < scope && task.status !== 'done'
}

/** The rows a year's pages show: those that pass `taskInYearScope`. */
export function inYearScope<T extends { task: Task; kids: readonly Task[] }>(
  rows: readonly T[],
  scope: YearScope
): T[] {
  return isAllYears(scope) ? [...rows] : rows.filter((r) => taskInYearScope(r.task, r.kids, scope))
}
