import { useSearchParams } from 'react-router'
import { resolveWeek } from '../shared/week'

/** The week the Hours page shows, kept in the URL (`?week=2026-09-28`, its Monday) so a link can open a given week. */
export function useWeek(
  yearStart: string,
  today: string
): { week: string; setWeek: (week: string) => void } {
  const [params, setParams] = useSearchParams()
  const week = resolveWeek(params.get('week'), yearStart, today)
  const setWeek = (next: string): void =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('week', next)
        return p
      },
      { replace: true }
    )
  return { week, setWeek }
}
