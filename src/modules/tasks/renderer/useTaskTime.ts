import type { TaskWorkspace } from '../shared/types'

/** The time Hours holds for each task (minutes by task uid), and which tasks have a timer running. Filled in with the Hours link. */
export function useTaskTime(workspace: TaskWorkspace): {
  tracked: ReadonlyMap<string, number>
  running: ReadonlySet<string>
} {
  void workspace
  return EMPTY
}

const EMPTY = { tracked: new Map<string, number>(), running: new Set<string>() }
