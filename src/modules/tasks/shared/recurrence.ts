import { addDays, dayNumber } from '@shared/year'
import type { NewTask, Recurrence, Task } from './types'

/** Whether a rule is usable: a whole number of days, weeks or months, at least one. */
export function isValidRecurrence(value: unknown): value is Recurrence {
  if (!value || typeof value !== 'object') return false
  const { every, unit } = value as Record<string, unknown>
  return (
    typeof every === 'number' &&
    Number.isInteger(every) &&
    every >= 1 &&
    every <= 366 &&
    (unit === 'day' || unit === 'week' || unit === 'month')
  )
}

/** A date plus some calendar months; a day that does not exist there (31 Jan + 1 month) becomes the month's last day. */
export function addMonths(date: string, months: number): string {
  if (dayNumber(date) === null) throw new Error(`Not a date: ${date}`)
  const [y, m, d] = date.split('-').map(Number)
  const index = y * 12 + (m - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`
}

/** The date a rule gives after `from`. */
export function addInterval(from: string, rule: Recurrence): string {
  if (rule.unit === 'day') return addDays(from, rule.every)
  if (rule.unit === 'week') return addDays(from, rule.every * 7)
  return addMonths(from, rule.every)
}

/** "Every day", "Every 2 weeks", "Every month". */
export function describeRecurrence(rule: Recurrence): string {
  const unit = rule.unit
  return rule.every === 1 ? `Every ${unit}` : `Every ${rule.every} ${unit}s`
}

/** What the next occurrence of a recurring task is made of: the task and its subtasks, ready to be created. */
export interface NextOccurrence {
  task: NewTask
  subtasks: NewTask[]
}

/**
 * The next occurrence of a recurring task, due the interval after the day it was handled (`completedOn`), so a
 * series drifts with the person. It is an ordinary task again, with the same title, notes, list, priority, tags and
 * rule, and every subtask copied, not done. A subtask that has its own date keeps its distance from the parent's
 * due date; one whose parent had no date loses its date. Null when the task does not repeat.
 */
export function nextOccurrence(
  task: Task,
  subtasks: readonly Task[],
  completedOn: string
): NextOccurrence | null {
  if (!task.recurrence || task.parentUid) return null
  const due = addInterval(completedOn, task.recurrence)
  const shift = (own: string | null): string | null => {
    if (!own || !task.due) return null
    const distance = (dayNumber(own) ?? 0) - (dayNumber(task.due) ?? 0)
    return addDays(due, distance)
  }
  return {
    task: {
      workspace: task.workspace,
      title: task.title,
      description: task.description,
      list: task.list,
      sublist: task.sublist,
      priority: task.priority,
      due,
      recurrence: task.recurrence,
      tags: [...task.tags]
    },
    subtasks: [...subtasks]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        workspace: task.workspace,
        title: s.title,
        description: s.description,
        priority: s.priority,
        due: shift(s.due),
        tags: [...s.tags]
      }))
  }
}
