import { academicYearLabel } from '@shared/academic-year'
import { Select } from './Select'

/** Chooses one of the academic years offered (newest first), shown as "2025–26". */
export function AcademicYearSelect({
  year,
  years,
  onChange
}: {
  year: number
  years: readonly number[]
  onChange: (year: number) => void
}): React.JSX.Element {
  return (
    <Select
      label="Academic year"
      value={String(year)}
      options={years.map((y) => ({ value: String(y), label: academicYearLabel(y) }))}
      onChange={(value) => onChange(Number(value))}
    />
  )
}
