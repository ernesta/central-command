import { useContractScope } from '@renderer/state/use-contract-filter'
import { useYearFilter } from '@renderer/state/use-year-filter'
import { ALL_YEARS } from '@shared/year-scope'
import { inContractLists } from '../shared/work-lists'
import { inYearScope } from '../shared/year-scope'
import type { TaskRow } from '../shared/views'
import type { TaskWorkspace } from '../shared/types'

/**
 * The rows a Tasks page shows under its workspace's one filter: Work's contract (the tasks in the contract's client lists) or
 * Research's academic year (by due date, `taskInYearScope`); Life has no filter. `rows` is null until everything the filter needs
 * has been read, so a page waits rather than show every task meanwhile. `filter` is the contract filter, for the pages that also
 * offer the contract's clients.
 */
export function useScopedRows(
  workspace: TaskWorkspace,
  everyRow: TaskRow[] | null
): { rows: TaskRow[] | null; filter: ReturnType<typeof useContractScope> } {
  const filter = useContractScope(workspace)
  const years = useYearFilter(workspace)
  const ready = everyRow !== null && filter.ready && years.loaded
  const rows = ready
    ? inYearScope(
        inContractLists(everyRow, filter.clients),
        years.applies ? years.scope : ALL_YEARS
      )
    : null
  return { rows, filter }
}
