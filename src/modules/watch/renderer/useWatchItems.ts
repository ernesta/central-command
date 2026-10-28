import { useCallback, useEffect, useState } from 'react'
import type { WatchItem, WatchItemsQuery, WatchState } from '../shared/types'
import { useWatchWorkspace } from './watch-paths'

export interface WatchItems {
  /** Null until the first read. */
  items: WatchItem[] | null
  /** Saves an item (which reads it), or takes the save back (a saved item becomes read). */
  toggleSaved: (item: WatchItem) => void
  /** Marks a new item read, or a read item new again. */
  toggleRead: (item: WatchItem) => void
  /** Opens the item's page in the browser; the first look makes a new item seen. */
  open: (item: WatchItem) => void
}

/** Items from this workspace's Watch (every state by default), read again whenever a check or a click changes them. */
export function useWatchItems(query: WatchItemsQuery = { limit: 1000 }): WatchItems {
  const workspace = useWatchWorkspace()
  const [items, setItems] = useState<WatchItem[] | null>(null)
  const key = JSON.stringify({ ...query, workspace })

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.watch.items
        .list(JSON.parse(key) as WatchItemsQuery)
        .then((next) => {
          if (!cancelled) setItems(next)
        })
        .catch(() => undefined)
    }
    load()
    const off = window.api.watch.onChanged(load)
    return () => {
      cancelled = true
      off()
    }
  }, [key])

  const setState = useCallback(
    (item: WatchItem, state: WatchState) => window.api.watch.items.setState(item.id, state),
    []
  )

  return {
    items,
    toggleSaved: (item) => void setState(item, item.state === 'saved' ? 'seen' : 'saved'),
    toggleRead: (item) => void setState(item, item.state === 'new' ? 'seen' : 'new'),
    open: (item) => {
      void window.api.watch.items.open(item.id)
      window.open(item.url, '_blank', 'noopener')
    }
  }
}
