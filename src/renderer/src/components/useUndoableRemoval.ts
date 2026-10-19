import { useEffect, useRef } from 'react'
import { pushUndo } from './undo-store'

/**
 * Removing one item of a list a field edits (a chip, a link). Cmd-Z puts it back where it was, into the list as it is by then, so
 * changes made since are kept; nothing is shown. Once the field is gone (its page left) the entry is skipped.
 */
export function useUndoableRemoval<T>(
  items: readonly T[],
  onChange: (next: T[]) => void,
  same: (a: T, b: T) => boolean = Object.is,
  describe: (item: T) => string = String
): (item: T) => void {
  const latest = useRef({ items, onChange })
  const mounted = useRef(true)
  useEffect(() => {
    latest.current = { items, onChange }
  })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  return (item) => {
    const at = items.findIndex((x) => same(x, item))
    if (at === -1) return
    onChange(items.filter((_, i) => i !== at))
    pushUndo({
      label: `removal of ${describe(item)}`,
      isStale: () => !mounted.current,
      undo: () => {
        const { items: now, onChange: set } = latest.current
        if (now.some((x) => same(x, item))) return
        const index = Math.min(at, now.length)
        set([...now.slice(0, index), item, ...now.slice(index)])
      }
    })
  }
}
