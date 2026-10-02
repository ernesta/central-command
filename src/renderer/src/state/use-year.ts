import { useSearchParams } from 'react-router'
import { currentYear, yearsPresent } from '@shared/year'
import { useSettings } from './settings-context'

/**
 * The year a list page shows (Meetings, Training), kept in the URL (`?year=2026-09-21`, the year's start) so a link
 * can open a page on a given year. It opens on the current year, is not remembered between visits, and a year that
 * has no dates and is not the current one falls back to the current year. The years offered are the shared ones
 * (`docs/DECISIONS.md`, "Hours and Time off": 52 weeks from a Monday, set in Settings).
 */
export function useYear(
  dates: readonly string[],
  today: string
): { year: string; years: string[]; setYear: (year: string) => void } {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const years = yearsPresent(dates, today, settings.yearStarts)
  const asked = params.get('year')
  const year = asked && years.includes(asked) ? asked : currentYear(today, settings.yearStarts)
  const setYear = (next: string): void =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('year', next)
        return p
      },
      { replace: true }
    )
  return { year, years, setYear }
}
