import { useEffect, useState } from 'react'
import { TASK_WORKSPACES, type TaskWorkspace } from '../shared/types'

const NONE: ReadonlySet<string> = new Set()

/**
 * The uids of a workspace's session tasks, the ones the app made for a meeting or a training lecture: their time is typed in the note,
 * so nothing is started on them or added to them (a lecture's study time goes to its self-study task). A task the user chose for a
 * meeting is not one. Read again when the tasks or the notes change.
 */
export function useSessionTaskUids(workspace: string): ReadonlySet<string> {
  const [uids, setUids] = useState<ReadonlySet<string>>(NONE)
  useEffect(() => {
    if (!(TASK_WORKSPACES as readonly string[]).includes(workspace)) return
    const w = workspace as TaskWorkspace
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = (): void => {
      void window.api.tasks.sessionTaskUids(w).then((list) => {
        if (!cancelled) setUids(new Set(list))
      })
    }
    // A burst of changes (a save, then the watcher reporting it) is read once.
    const later = (): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(load, 30)
    }
    load()
    const offs = [
      window.api.tasks.onChanged((event) => event.workspace === w && later()),
      window.api.meetings.onChanged(later),
      window.api.training.onChanged(later)
    ]
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      for (const off of offs) off()
    }
  }, [workspace])
  return uids
}
