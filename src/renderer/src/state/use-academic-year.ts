import { useSearchParams } from 'react-router'
import { academicYearsPresent, currentAcademicYear } from '@shared/academic-year'

/**
 * The academic year a page shows, kept in the URL (`?year=2025`) so a link can open a page on a given
 * year. It opens on the current year, is not remembered between visits, and a year that has no
 * entries and is not the current one falls back to the current year.
 */
export function useAcademicYear(
  dates: readonly string[],
  today: string
): { year: number; years: number[]; setYear: (year: number) => void } {
  const [params, setParams] = useSearchParams()
  const years = academicYearsPresent(dates, today)
  const asked = Number(params.get('year'))
  const year = years.includes(asked) ? asked : currentAcademicYear(today)
  const setYear = (next: number): void =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('year', String(next))
        return p
      },
      { replace: true }
    )
  return { year, years, setYear }
}
