import type { Workspace } from '@shared/settings'
import { hasContracts } from '@shared/tracking/workspace-weeks'
import { YEAR_FILTER_WORKSPACES } from '../state/use-year-filter'
import { YearSelect } from './YearSelect'

/**
 * The year selector a tracking page puts in its header (Life). Work and Research have none here: their one filter is in the top bar. Pass what
 * `useTrackingYear` or `usePeriod` give.
 */
export function PeriodSelect({
  workspace,
  year,
  years,
  onYear
}: {
  workspace: Workspace
  year: string
  years: readonly string[]
  onYear: (year: string) => void
}): React.JSX.Element | null {
  // Work's contract filter and Research's academic year filter live in the top bar, beside the workspace tabs.
  return hasContracts(workspace) || YEAR_FILTER_WORKSPACES.includes(workspace) ? null : (
    <YearSelect year={year} years={years} onChange={onYear} />
  )
}
