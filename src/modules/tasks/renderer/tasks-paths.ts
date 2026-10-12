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

export { todayIso } from '@shared/time'
