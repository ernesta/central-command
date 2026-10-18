import { useEffect, useMemo, useState } from 'react'
import type { Workspace } from '@shared/settings'
import { useLectureTaskUids } from '../../training/renderer/useLectureTaskUids'
import { TASK_WORKSPACES, type Task, type TaskWorkspace } from '../shared/types'

/**
 * The tasks that are not done in a workspace (top-level and subtasks), for Hours to offer by name and to link time to. A training
 * lecture's own task is left out: its time is typed in the note, and the hours go to its self-study task. Empty for a workspace without tasks. Read again when the tasks change.
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
  const lectures = useLectureTaskUids()
  return useMemo(
    () => (workspace === 'research' ? tasks.filter((t) => !lectures.has(t.uid)) : tasks),
    [tasks, lectures, workspace]
  )
}
