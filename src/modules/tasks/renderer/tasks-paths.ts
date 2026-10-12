import { useLocation } from 'react-router'
import { modulePath } from '@modules/types'
import { TASK_WORKSPACES, type TaskWorkspace } from '../shared/types'

export function tasksBase(workspace: TaskWorkspace): string {
  return modulePath({ workspace, id: 'tasks' })
}

/** All tasks; with a list, that list's page (All tasks with the list filter set). */
export function tasksAllRoute(
  workspace: TaskWorkspace,
  options: { list?: string; view?: 'open' | 'backlog' | 'done' } = {}
): string {
  const params = new URLSearchParams()
  if (options.list) params.set('list', options.list)
  if (options.view) params.set('view', options.view)
  const query = params.toString()
  return `${tasksBase(workspace)}/all${query ? `?${query}` : ''}`
}

/** One task's page. */
export function taskRoute(workspace: TaskWorkspace, uid: string): string {
  return `${tasksBase(workspace)}/t/${encodeURIComponent(uid)}`
}

/** Which workspace's tasks the current page belongs to, read from the URL (`/research/…` or `/work/…`). */
export function useTasksWorkspace(): TaskWorkspace {
  const { pathname } = useLocation()
  const segment = pathname.split('/')[1]
  return (TASK_WORKSPACES as readonly string[]).includes(segment)
    ? (segment as TaskWorkspace)
    : 'research'
}

/** Where a task page's back link goes: the page the task was opened from, else the Tasks landing. */
export interface TaskBack {
  to: string
  label: string
}

/** Router state for a link to a task page, remembering the page it is opened from. */
export function useTaskLinkState(): { from: TaskBack } {
  const { pathname, search } = useLocation()
  return {
    from: { to: pathname + search, label: pathname.endsWith('/all') ? 'All tasks' : 'Tasks' }
  }
}

export function useTaskBack(workspace: TaskWorkspace): TaskBack {
  const { state } = useLocation()
  const from = (state as { from?: TaskBack } | null)?.from
  return from ?? { to: tasksBase(workspace), label: 'Tasks' }
}

export { todayIso } from '@shared/time'
