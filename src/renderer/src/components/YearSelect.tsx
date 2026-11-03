import { yearLabel } from '@shared/year'
import { Select } from './Select'
import styles from './YearSelect.module.css'

/**
 * Chooses one of the years offered (newest first), by its start date, shown as "2026–27". Hours, Time off and the charts share
 * it. It reads `Year [2026–27 ⌄]`: the label sits directly before the dropdown, wherever the select is placed. Work has no years
 * but contracts, and its one filter is `ContractFilter`.
 */
export function YearSelect({
  year,
  years,
  onChange
}: {
  year: string
  years: readonly string[]
  onChange: (year: string) => void
}): React.JSX.Element {
  return (
    <span className={styles.field}>
      <span className={styles.label} aria-hidden>
        Year
      </span>
      <Select
        label="Year"
        value={year}
        options={years.map((y) => ({ value: y, label: yearLabel(y) }))}
        onChange={onChange}
      />
    </span>
  )
}
