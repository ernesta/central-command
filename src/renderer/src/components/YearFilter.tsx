import { yearLabel } from '@shared/year'
import { type YearScope } from '@shared/year-scope'
import { ScopeSelect } from './ScopeSelect'

/**
 * Research's one academic year filter, in the top bar beside the workspace tabs: `[All years ⌄]`, then each year newest first
 * (`2026–27`). The choice is the whole workspace's (`useYearFilter`).
 */
export function YearFilter({
  scope,
  years,
  onChange
}: {
  scope: YearScope
  years: readonly string[]
  onChange: (scope: YearScope) => void
}): React.JSX.Element {
  return (
    <ScopeSelect
      label="Academic year"
      all="All years"
      scope={scope}
      choices={years.map((y) => ({ value: y, label: yearLabel(y) }))}
      onChange={onChange}
    />
  )
}
