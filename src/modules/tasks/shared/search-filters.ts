import { addDays, dayItem } from '@shared/search-dates'
import { dateFilterMatches, type SearchFilter } from '@shared/search-query'
import { fold } from '@shared/text'
import type { Task } from './types'

const STATUS: Record<string, (task: Task) => boolean> = {
  'to do': (t) => t.status === 'todo',
  'in progress': (t) => t.status === 'doing',
  done: (t) => t.status === 'done',
  open: (t) => t.status !== 'done'
}

const PRIORITY: Record<string, Task['priority']> = { p1: 'high', p2: 'normal', p3: 'low' }

/** A task's list and sublist: a subtask shows its parent's. */
function listOf(task: Task, byUid: ReadonlyMap<string, Task>): { list: string; sublist: string } {
  const parent = task.parentUid ? byUid.get(task.parentUid) : undefined
  return parent ? { list: parent.list, sublist: parent.sublist } : task
}

/** Whether a task passes one search filter, before negation. A filter tasks do not have is false. */
export function taskMatches(
  task: Task,
  byUid: ReadonlyMap<string, Task>,
  filter: SearchFilter,
  today: string
): boolean {
  const value = filter.value
  switch (filter.name) {
    case 'status':
      return STATUS[value]?.(task) ?? false
    case 'priority':
      return task.priority === PRIORITY[value]
    case 'due':
      if (task.due === null) return false
      if (value === 'today') return task.due === today
      if (value === 'tomorrow') return task.due === addDays(today, 1)
      if (value === 'overdue') return task.due < today && task.status !== 'done'
      return task.due >= today && task.due <= addDays(today, 6)
    case 'list': {
      const { list, sublist } = listOf(task, byUid)
      const slash = value.indexOf('/')
      if (slash < 0) return fold(list) === value
      return (
        fold(list) === value.slice(0, slash).trim() &&
        fold(sublist) === value.slice(slash + 1).trim()
      )
    }
    case 'tag':
      return task.tags.some((t) => fold(t) === value)
    case 'has':
      return value === 'due' ? task.due !== null : task.description.trim() !== ''
    case 'before':
    case 'after':
    case 'on':
    case 'during':
      return dateFilterMatches(filter, today, dayItem(task.due))
    default:
      return false
  }
}
