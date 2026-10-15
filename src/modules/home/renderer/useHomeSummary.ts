import { useEffect, useState } from 'react'
import type { HomeSummary } from '../shared/types'

/**
 * The Home summary, read again when anything it is made of changes (tasks, meetings, trainings), when the window
 * comes back into focus, and every minute (a meeting passes, midnight comes). Null until the first read.
 */
export function useHomeSummary(): HomeSummary | null {
  const [summary, setSummary] = useState<HomeSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.home
        .summary()
        .then((next) => {
          if (!cancelled) setSummary(next)
        })
        .catch(() => undefined)
    }
    load()
    const offs = [
      window.api.tasks.onChanged(load),
      window.api.meetings.onChanged(load),
      window.api.training.onChanged(load)
    ]
    const timer = setInterval(load, 60_000)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      for (const off of offs) off()
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [])

  return summary
}
