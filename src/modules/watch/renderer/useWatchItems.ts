import { useCallback, useEffect, useMemo, useState } from 'react'
import { sortItems, type Held } from '../shared/query'
import type { WatchItem, WatchItemsQuery, WatchState } from '../shared/types'
import { setStateUndoable } from './item-state-undo'
import { useWatchWorkspace } from './watch-paths'

export interface WatchItems {
  /** Null until the first read. In the list's order, a held row where it was. */
  items: WatchItem[] | null
  /** The rows opened since the page was shown: Read, but kept where they were and dimmed until the page is left (`query.ts`, `Held`). */
  held: Held
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
  const [loaded, setItems] = useState<WatchItem[] | null>(null)
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set())
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

  const items = useMemo(() => (loaded ? sortItems(loaded, held) : null), [loaded, held])

  const hold = useCallback((id: number, on: boolean) => {
    setHeld((current) => {
      if (current.has(id) === on) return current
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const setState = useCallback(
    (item: WatchItem, state: WatchState) =>
      setStateUndoable(item, state, window.api.watch.items.setState, () => hold(item.id, false)),
    [hold]
  )

  return {
    items,
    held,
    // Any choice about the row (Save, Mark new, Cmd-Z) lets it go to where its state puts it.
    toggleSaved: (item) => {
      hold(item.id, false)
      void setState(item, item.state === 'saved' ? 'seen' : 'saved')
    },
    toggleRead: (item) => {
      hold(item.id, false)
      void setState(item, item.state === 'new' ? 'seen' : 'new')
    },
    open: (item) => {
      if (item.state === 'new') {
        hold(item.id, true)
        void setState(item, 'seen')
      } else void window.api.watch.items.open(item.id)
      window.open(item.url, '_blank', 'noopener')
    }
  }
}
