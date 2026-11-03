import { type ContractScope } from '@shared/tracking/scope'
import { contractLabel } from '@shared/tracking/workspace-weeks'
import type { Workspace } from '@shared/settings'
import { useYearFiles } from '../state/use-year-files'
import { ScopeSelect } from './ScopeSelect'

/**
 * Work's one contract filter, in the header of every Work page that has contract content, at the right end: `[All contracts ⌄]`,
 * then each contract by name and dates. The choice is the whole workspace's (`useContractFilter`).
 */
export function ContractFilter({
  scope,
  starts,
  onChange,
  workspace = 'work'
}: {
  scope: ContractScope
  starts: readonly string[]
  onChange: (scope: ContractScope) => void
  workspace?: Workspace
}): React.JSX.Element {
  // A contract's last day comes from its file; until it is read, the first day alone.
  const files = useYearFiles(workspace, starts)
  const label = (start: string): string => {
    const file = files?.find((f) => f.start === start)
    return contractLabel(start, file?.weeks, file?.name, file?.end)
  }
  return (
    <ScopeSelect
      label="Contract"
      all="All contracts"
      scope={scope}
      choices={starts.map((s) => ({ value: s, label: label(s) }))}
      onChange={onChange}
    />
  )
}
