import { useEffect, useState } from 'react'
import type { ReadingListIndexRow } from '@modules/reading-lists/shared/types'

/**
 * Every reading list in the Research workspace from the index. Refreshed when a list file changes
 * (from this app or another tool). `rows` is null until the first load.
 */
export function useReadingListsList(): ReadingListIndexRow[] | null {
  const [rows, setRows] = useState<ReadingListIndexRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = (): void => {
      void window.api.readingLists.list('research').then((list) => {
        if (!cancelled) setRows(list)
      })
    }
    load()
    const off = window.api.readingLists.onChanged(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(load, 150)
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      off()
    }
  }, [])

  return rows
}
