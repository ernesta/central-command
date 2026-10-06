import { hasContracts } from '@shared/tracking/workspace-weeks'
import { formatDate } from '@shared/time'
import { addDays, yearLabel } from '@shared/year'
import type { Workspace } from '@shared/settings'
import type { TrackingYear } from '@shared/tracking/types'
import { useYearFiles } from '../state/use-year-files'
import { Select } from './Select'

/**
 * A contract by its name and its first and last day: "Luminos · 1 May 2026 – 29 Oct 2026" (the dates alone when it has
 * no name). Without its length, by its first day.
 */
export function contractLabel(start: string, weeks: number | undefined, name?: string): string {
  const dates =
    weeks === undefined
      ? formatDate(start)
      : `${formatDate(start)} – ${formatDate(addDays(start, weeks * 7 - 1))}`
  return name ? `${name} · ${dates}` : dates
}

function contractLabelOf(file: TrackingYear | undefined, start: string): string {
  return contractLabel(start, file?.weeks, file?.name)
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
    contracts
      ? contractLabelOf(
          files?.find((f) => f.start === y),
          y
        )
      : yearLabel(y)
  return (
    <Select
      label={contracts ? 'Contract' : 'Year'}
      value={year}
      options={years.map((y) => ({ value: y, label: label(y) }))}
      onChange={onChange}
    />
  )
}
