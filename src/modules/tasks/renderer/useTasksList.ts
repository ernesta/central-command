import { useEffect, useMemo, useState } from 'react'
import type { Task, TaskWorkspace } from '../shared/types'
import { groupTasks, type TaskRow } from '../shared/views'

/**
 * Every task of a workspace (subtasks included), grouped into rows. Refreshed after any change to the tasks, from any page.
 * `rows` is null until the first load.
 */
export function useTasksList(workspace: TaskWorkspace): {
  tasks: Task[] | null
  rows: TaskRow[] | null
} {
  const [tasks, setTasks] = useState<Task[] | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = (): void => {
      void window.api.tasks.list(workspace).then((list) => {
        if (!cancelled) setTasks(list)
      })
    }
    load()
    const off = window.api.tasks.onChanged((event) => {
      if (event.workspace !== workspace) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(load, 30)
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      off()
    }
  }, [workspace])

  const rows = useMemo(() => (tasks ? groupTasks(tasks) : null), [tasks])
  return { tasks, rows }
}
