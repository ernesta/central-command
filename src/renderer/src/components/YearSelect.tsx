import { hasContracts } from '@shared/tracking/workspace-weeks'
import { formatDate } from '@shared/time'
import { addDays, yearLabel } from '@shared/year'
import type { Workspace } from '@shared/settings'
import { useYearFiles } from '../state/use-year-files'
import { Select } from './Select'

/** A contract named by its first and last day: "1 May 2026 – 30 Apr 2027". Without its length, by its first day. */
function contractLabel(start: string, weeks: number | undefined): string {
  return weeks === undefined
    ? formatDate(start)
    : `${formatDate(start)} – ${formatDate(addDays(start, weeks * 7 - 1))}`
}

/**
 * Chooses one of the years offered (newest first), by its start date, shown as "2026–27", or as a contract's first
 * and last day for a workspace with contracts. Hours, Time off and the charts share it.
 */
export function YearSelect({
  year,
  years,
  onChange,
  workspace = 'research'
}: {
  year: string
  years: readonly string[]
  onChange: (year: string) => void
  workspace?: Workspace
}): React.JSX.Element {
  const contracts = hasContracts(workspace)
  // A contract's last day comes from its file; until it is read, the first day alone.
  const files = useYearFiles(workspace, contracts ? years : [])
  const label = (y: string): string =>
    contracts ? contractLabel(y, files?.find((f) => f.start === y)?.weeks) : yearLabel(y)
  return (
    <Select
      label={contracts ? 'Contract' : 'Year'}
      value={year}
      options={years.map((y) => ({ value: y, label: label(y) }))}
      onChange={onChange}
    />
  )
}
