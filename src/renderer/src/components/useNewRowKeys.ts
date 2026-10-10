import { useEffect, useRef, useState } from 'react'

const FLASH_MS = 1400

/**
 * Which of `keys` appeared only after this hook first ran — never a page's own rows on open, only ones a later
 * action (add, edit, import) brings in. Each key stays for a moment, for a one-time highlight animation; apply it
 * with a CSS class whose `animation` plays automatically when the row mounts (a `row-added` keyframe, declared
 * alongside the class that uses it — see `.entering` in TimeOffList.module.css for the pattern).
 */
export function useNewRowKeys(keys: readonly string[]): ReadonlySet<string> {
  const seen = useRef<Set<string>>(new Set(keys))
  // One timer per flashing key, independent of this effect's own re-runs: an unrelated re-render must
  // never cancel another key's already-scheduled clear (it once did, leaving a flash stuck forever).
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [entering, setEntering] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const fresh = keys.filter((key) => !seen.current.has(key))
    keys.forEach((key) => seen.current.add(key))
    if (fresh.length === 0) return
    setEntering((prev) => new Set([...prev, ...fresh]))
    fresh.forEach((key) => {
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key)
          setEntering((prev) => {
            if (!prev.has(key)) return prev
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        }, FLASH_MS)
      )
    })
  }, [keys])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  return entering
}
