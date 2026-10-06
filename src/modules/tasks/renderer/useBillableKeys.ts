import { useEffect, useState } from 'react'
import type { Workspace } from '@shared/settings'
import { billableTasks } from '../shared/billable'
import { taskKey } from '../shared/tracked'
import { TASK_WORKSPACES, type TaskWorkspace } from '../shared/types'

/**
 * The keys (`cc://task/<uid>`) of a workspace's billable tasks, done ones included, for Hours to tell billable time from the
 * rest. Null until read, and for a workspace without tasks. Read again when the tasks change.
 */
export function useBillableKeys(workspace: Workspace): ReadonlySet<string> | null {
  const [keys, setKeys] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    if (!(TASK_WORKSPACES as readonly string[]).includes(workspace)) return
    const w = workspace as TaskWorkspace
    let cancelled = false
    const load = (): void => {
      void window.api.tasks.list(w).then((list) => {
        if (!cancelled) setKeys(new Set(billableTasks(list).map((t) => taskKey(t.uid))))
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
  return keys
}
