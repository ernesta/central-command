import { useEffect, useState } from 'react'
import type { Workspace } from '@shared/settings'
import { TASK_WORKSPACES, type Task, type TaskWorkspace } from '../shared/types'

/**
 * The tasks that are not done in a workspace (top-level and subtasks), for Hours to offer by name and to link time to. Empty for a workspace without tasks. Read again when the tasks change.
 */
export function useOpenTasks(workspace: Workspace): Task[] {
  const [tasks, setTasks] = useState<Task[]>([])
  useEffect(() => {
    if (!(TASK_WORKSPACES as readonly string[]).includes(workspace)) return
    const w = workspace as TaskWorkspace
    let cancelled = false
    const load = (): void => {
      void window.api.tasks.list(w).then((list) => {
        if (cancelled) return
        setTasks(list.filter((t) => t.status !== 'done'))
      })
    }
    load()
    const off = window.api.tasks.onChanged((event) => {
      if (event.workspace === w) load()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [workspace])
  return tasks
}
