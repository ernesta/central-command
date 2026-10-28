import { useEffect, useMemo, useState } from 'react'
import type { Task, TaskWorkspace } from '../shared/types'
import { seriesUids, visibleTasks } from '../shared/session-lock'
import { groupTasks, type TaskRow } from '../shared/views'

/**
 * Every task of a workspace (subtasks included) that a task view shows (not the meeting and training session tasks, `hiddenTaskUids`), grouped into rows. Refreshed after any change to the tasks, from any page.
 * `rows` is null until the first load.
 */
export function useTasksList(
  workspace: TaskWorkspace,
  /** For the pages that must still find a hidden task (its own page, the note that made it, Hours). */
  includeHidden = false
): {
  tasks: Task[] | null
  rows: TaskRow[] | null
  /** The series tasks among every task, hidden subtasks included (`seriesUids`): for the lock, which the shown rows cannot tell. */
  series: ReadonlySet<string>
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

  const shown = useMemo(
    () => (tasks && !includeHidden ? visibleTasks(tasks) : tasks),
    [tasks, includeHidden]
  )
  const rows = useMemo(() => (shown ? groupTasks(shown) : null), [shown])
  const series = useMemo(() => seriesUids(tasks ?? []), [tasks])
  return { tasks: shown, rows, series }
}
