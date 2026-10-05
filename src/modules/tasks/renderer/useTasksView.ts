import { useModuleState } from '@renderer/state/use-module-state'
import { normaliseTasksQuery, type TasksQuery } from '../shared/query'
import type { TaskWorkspace } from '../shared/types'

/** The All tasks list's search, filters and sort, remembered between visits and launches, separately per workspace. */
export function useTasksView(
  workspace: TaskWorkspace,
  initial?: Partial<TasksQuery>
): { query: TasksQuery; setQuery: (patch: Partial<TasksQuery>) => void } {
  const { value, update } = useModuleState(`tasks-view-${workspace}`, normaliseTasksQuery, initial)
  return { query: value, setQuery: update }
}
