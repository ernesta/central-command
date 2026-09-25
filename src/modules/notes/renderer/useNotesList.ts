import { useEffect, useState } from 'react'
import type { NoteIndexRow } from '../shared/types'

/**
 * Every note in the Research workspace from the index. Refreshed when a note file changes (from this app
 * or another tool). `rows` is null until the first load.
 */
export function useNotesList(): NoteIndexRow[] | null {
  const [rows, setRows] = useState<NoteIndexRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const load = (): void => {
      void window.api.notes.list('research').then((list) => {
        if (!cancelled) setRows(list)
      })
    }
    load()
    // Several files can change at once (an import); refresh once for the burst.
    const off = window.api.notes.onChanged(() => {
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
