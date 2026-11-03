import { ALL_CONTRACTS, type ContractScope } from '@shared/tracking/scope'
import { contractLabel } from '@shared/tracking/workspace-weeks'
import type { Workspace } from '@shared/settings'
import { useYearFiles } from '../state/use-year-files'
import { Select } from './Select'
import styles from './YearSelect.module.css'

/**
 * Work's one contract filter, in the header of every Work page that has contract content, at the right end: `Contract [All contracts ⌄]`,
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
    <span className={styles.field}>
      <span className={styles.label} aria-hidden>
        Contract
      </span>
      <Select
        label="Contract"
        value={scope}
        options={[
          { value: ALL_CONTRACTS, label: 'All contracts' },
          ...starts.map((s) => ({ value: s, label: label(s) }))
        ]}
        onChange={onChange}
      />
    </span>
  )
}
