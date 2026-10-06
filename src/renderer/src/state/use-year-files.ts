import { useEffect, useState } from 'react'
import type { Workspace } from '@shared/settings'
import type { TrackingYear } from '@shared/tracking/types'

/**
 * Every one of the given years' files for a workspace, read again whenever one changes. Null until all are read.
 * The list is keyed by its contents so a new array with the same years does not read everything again.
 */
export function useYearFiles(
  workspace: Workspace,
  years: readonly string[]
): TrackingYear[] | null {
  const key = `${workspace}/${years.join(',')}`
  const [loaded, setLoaded] = useState<{ key: string; data: TrackingYear[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    const list = key
      .slice(key.indexOf('/') + 1)
      .split(',')
      .filter(Boolean)
    const load = (): void => {
      void Promise.all(list.map((y) => window.api.tracking.get(workspace, y))).then((data) => {
        if (!cancelled) setLoaded({ key, data })
      })
    }
    load()
    const off = window.api.tracking.onChanged((event) => {
      if (event.workspace === workspace && list.includes(event.year)) load()
    })
    return () => {
      cancelled = true
      off()
    }
  }, [workspace, key])

  return loaded?.key === key ? loaded.data : null
}
