import { useEffect, useState } from 'react'
import type { ReadingsQuery, TagCount } from '../shared/query'
import type { Reading } from '../shared/types'

interface ReadingsList {
  /** null until the first result arrives. */
  readings: Reading[] | null
  tags: TagCount[]
}

/**
 * Readings matching `query`, refetched whenever the query changes or `refreshKey` does
 * (pass something that changes after each sync). Stale responses are discarded.
 */
export function useReadingsList(query: ReadingsQuery, refreshKey: string): ReadingsList {
  const [readings, setReadings] = useState<Reading[] | null>(null)
  const [tags, setTags] = useState<TagCount[]>([])
  const queryKey = JSON.stringify(query)

  useEffect(() => {
    let cancelled = false
    void window.api.readings.list(JSON.parse(queryKey)).then((result) => {
      if (!cancelled) setReadings(result)
    })
    return () => {
      cancelled = true
    }
  }, [queryKey, refreshKey])

  useEffect(() => {
    let cancelled = false
    void window.api.readings.tags().then((result) => {
      if (!cancelled) setTags(result)
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return { readings, tags }
}
