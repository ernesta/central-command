import { contractLabel, hasContracts } from '@shared/tracking/workspace-weeks'
import { yearLabel } from '@shared/year'
import type { Workspace } from '@shared/settings'
import type { TrackingYear } from '@shared/tracking/types'
import { useYearFiles } from '../state/use-year-files'
import { Select } from './Select'
import styles from './YearSelect.module.css'

function contractLabelOf(file: TrackingYear | undefined, start: string): string {
  return contractLabel(start, file?.weeks, file?.name)
}

/**
 * Chooses one of the years offered (newest first), by its start date, shown as "2026–27", or as a contract's first
 * and last day for a workspace with contracts. Hours, Time off and the charts share it. It reads `Year [2026–27 ⌄]`
 * (`Contract [...]` for a workspace with contracts): the label sits directly before the dropdown, wherever the select is placed.
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
  const name = contracts ? 'Contract' : 'Year'
  return (
    <span className={styles.field}>
      <span className={styles.label} aria-hidden>
        {name}
      </span>
      <Select
        label={name}
        value={year}
        options={years.map((y) => ({ value: y, label: label(y) }))}
        onChange={onChange}
      />
    </span>
  )
}
