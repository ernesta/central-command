import { useEffect, useState } from 'react'
import type { WatchTaskLink } from '@modules/tasks/shared/watch-links'
import { useWatchWorkspace } from './watch-paths'

/**
 * The tasks made from this workspace's Watch items, by item id (an open task first, see `watchLinks`), read again whenever the
 * tasks change. Empty until the first read.
 */
export function useWatchTasks(): ReadonlyMap<number, WatchTaskLink> {
  const workspace = useWatchWorkspace()
  const [links, setLinks] = useState<ReadonlyMap<number, WatchTaskLink>>(new Map())

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.tasks
        .watchLinks(workspace)
        .then((next) => {
          if (!cancelled) setLinks(new Map(next.map((l) => [l.itemId, l])))
        })
        .catch(() => undefined)
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

  return links
}
