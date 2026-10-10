import { useEffect, useState } from 'react'
import type { RenameSuggestion } from '../shared/types'

/** Pending suggested renames, refetched whenever `refreshKey` changes. */
export function useRenameSuggestions(refreshKey: string): RenameSuggestion[] {
  const [suggestions, setSuggestions] = useState<RenameSuggestion[]>([])

  useEffect(() => {
    let cancelled = false
    void window.api.readings.renameSuggestions.list().then((result) => {
      if (!cancelled) setSuggestions(result)
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return suggestions
}
