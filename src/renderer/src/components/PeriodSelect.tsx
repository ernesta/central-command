import type { Workspace } from '@shared/settings'
import { hasContracts } from '@shared/tracking/workspace-weeks'
import { YearSelect } from './YearSelect'

/**
 * The year selector a tracking page puts in its header (Research and Life). Work has none here: its contract filter is in the top bar. Pass what
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
  // Work's contract filter lives in the top bar, beside the workspace tabs.
  return hasContracts(workspace) ? null : <YearSelect year={year} years={years} onChange={onYear} />
}
