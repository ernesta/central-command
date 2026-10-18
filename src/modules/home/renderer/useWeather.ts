import { useEffect, useState } from 'react'
import type { WeatherSummary } from '../shared/types'

/** Reads every 30 minutes (the service reuses a reading that long anyway) and when the window comes back into focus. */
const REFRESH_MS = 30 * 60_000

/** The weather for the page heading; null while off, unset, unreachable or not yet read. Reads nothing while off. */
export function useWeather(): WeatherSummary | null {
  const [weather, setWeather] = useState<WeatherSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void window.api.home
        .weather()
        .then((next) => {
          if (!cancelled) setWeather(next)
        })
        .catch(() => undefined)
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [])

  return weather
}
