import { useCallback, useEffect, useState } from 'react'
import type { MeetingWorkspace } from '../shared/types'

/**
 * Work's task lists by task uid (a subtask sits in its parent's list), read again when the tasks change: which client a meeting's
 * task stands for. Research has no clients, so it reads nothing.
 */
export function useTaskLists(workspace: MeetingWorkspace): (taskUid: string) => string {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    if (workspace !== 'work') return
    let cancelled = false
    const load = (): void => {
      void window.api.tasks.list(workspace).then((tasks) => {
        if (cancelled) return
        const byUid = new Map(tasks.map((t) => [t.uid, t]))
        setLoaded(
          new Map(
            tasks.map((t) => [
              t.uid,
              t.list || (t.parentUid ? (byUid.get(t.parentUid)?.list ?? '') : '')
            ])
          )
        )
      })
    }
    load()
    const off = window.api.tasks.onChanged((event) => {
      if (event.workspace === workspace) load()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [workspace])
  return useCallback((uid: string) => loaded.get(uid) ?? '', [loaded])
}
