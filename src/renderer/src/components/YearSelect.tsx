import { yearLabel } from '@shared/year'
import { Select } from './Select'

/** Chooses one of the years offered (newest first), by its start date, shown as "2026–27". Hours, Time off and the charts share it. */
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
    <Select
      label="Year"
      value={year}
      options={years.map((y) => ({ value: y, label: yearLabel(y) }))}
      onChange={onChange}
    />
  )
}
