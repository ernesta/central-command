import { useEffect, useMemo, useState } from 'react'
import type { Workspace } from '@shared/settings'
import { visibleTasks } from '../shared/session-lock'
import { useSessionTaskUids } from './useSessionTaskUids'
import { TASK_WORKSPACES, type Task, type TaskWorkspace } from '../shared/types'

/**
 * The tasks that are not done in a workspace (top-level and subtasks), for Hours to offer by name and to link time to. A session task
 * (a meeting's own task, a training's own task) is left out: its time is typed in the note, and a training's study hours go to
 * its self-study task. Empty for a workspace without tasks. Read again when the tasks change.
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
        setTasks(visibleTasks(list).filter((t) => t.status !== 'done'))
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
  const session = useSessionTaskUids(workspace)
  return useMemo(() => tasks.filter((t) => !session.has(t.uid)), [tasks, session])
}
