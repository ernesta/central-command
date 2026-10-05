import { hasContracts } from '@shared/tracking/workspace-weeks'
import { formatDate } from '@shared/time'
import { yearLabel } from '@shared/year'
import { Select } from './Select'

/** A contract named by its first day: "1 May 2026". */
function contractLabel(start: string): string {
  return formatDate(start)
}

/**
 * Chooses one of the years offered (newest first), by its start date, shown as "2026–27", or as a contract's first
 * day for a workspace with contracts. Hours, Time off and the charts share it.
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
  workspace?: string
}): React.JSX.Element {
  const label = hasContracts(workspace) ? contractLabel : yearLabel
  return (
    <Select
      label={hasContracts(workspace) ? 'Contract' : 'Year'}
      value={year}
      options={years.map((y) => ({ value: y, label: label(y) }))}
      onChange={onChange}
    />
  )
}
