import { useEffect, useState } from 'react'
import type { TaskWorkspace } from '../shared/types'

const NONE: readonly string[] = []

/**
 * The top-level lists a workspace allows: in Work its clients (read again when a contract or a client changes and when the
 * tasks do), null in Research, whose lists are free. Until Work's are read there are none, so nothing outside the rule is
 * offered meanwhile.
 */
export function useWorkClients(workspace: TaskWorkspace): readonly string[] | null {
  const [loaded, setLoaded] = useState<{ workspace: TaskWorkspace; clients: string[] } | null>(null)
  useEffect(() => {
    if (workspace !== 'work') return
    let cancelled = false
    const load = (): void => {
      void window.api.tasks.clients(workspace).then((clients) => {
        if (!cancelled && clients) setLoaded({ workspace, clients })
      })
    }
    load()
    const offTracking = window.api.tracking.onChanged((event) => {
      if (event.workspace === workspace) load()
    })
    const offTasks = window.api.tasks.onChanged((event) => {
      if (event.workspace === workspace) load()
    })
    return () => {
      cancelled = true
      offTracking()
      offTasks()
    }
  }, [workspace])
  if (workspace !== 'work') return null
  return loaded?.workspace === workspace ? loaded.clients : NONE
}
