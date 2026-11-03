import type { Workspace } from '@shared/settings'
import type { ContractScope } from '@shared/tracking/scope'
import { hasContracts } from '@shared/tracking/workspace-weeks'
import { ContractFilter } from './ContractFilter'
import { YearSelect } from './YearSelect'

/**
 * The one selector a tracking page puts in its header: Work's contract filter, or the year for Research and Life. Pass what
 * `useTrackingYear` or `usePeriod` give.
 */
export function PeriodSelect({
  workspace,
  year,
  years,
  onYear,
  scope,
  onScope
}: {
  workspace: Workspace
  year: string
  years: readonly string[]
  onYear: (year: string) => void
  scope: ContractScope
  onScope: (scope: ContractScope) => void
}): React.JSX.Element {
  return hasContracts(workspace) ? (
    <ContractFilter scope={scope} starts={years} onChange={onScope} workspace={workspace} />
  ) : (
    <YearSelect year={year} years={years} onChange={onYear} />
  )
}
