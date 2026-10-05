import { TASK_WORKSPACES, type Task } from '../shared/types'

/** Every task of every workspace, reused for a couple of seconds (the picker and the search ask on every keystroke). */
let cached: { at: number; tasks: Promise<Task[]> } | null = null

export function allTasks(fresh = false): Promise<Task[]> {
  if (fresh || !cached || Date.now() - cached.at > 2000) {
    cached = {
      at: Date.now(),
      tasks: Promise.all(TASK_WORKSPACES.map((w) => window.api.tasks.list(w))).then((lists) =>
        lists.flat()
      )
    }
  }
  return cached.tasks
}
