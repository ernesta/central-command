import { useEffect, useState } from 'react'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatDate } from '@shared/time'
import { addDays } from '@shared/year'
import type { TrackingYear } from '@shared/tracking/types'
import { formatAimHours } from '../shared/plan-settings'
import type { HoursWorkspace } from '../shared/workspaces'
import styles from './ContractsTable.module.css'

/** One contract as a table row: the first day, the last day and what the plan says. */
function ContractRow({
  contract,
  current
}: {
  contract: TrackingYear
  current: boolean
}): React.JSX.Element {
  const weeks = contract.weeks ?? 52
  return (
    <tr aria-current={current || undefined}>
      <th scope="row">{contract.name ?? '–'}</th>
      <td>{formatDate(contract.start)}</td>
      <td>{formatDate(addDays(contract.start, weeks * 7 - 1))}</td>
      <td>{(contract.plan.clients ?? []).join(', ') || '–'}</td>
      <td className={styles.number}>{formatAimHours(contract.plan.hoursPerWeek)}</td>
      <td>{contract.invoice === 'week' ? 'Week' : 'Month'}</td>
    </tr>
  )
}

/** Every contract of a workspace, newest first, with the one being edited marked. */
export function ContractsTable({
  workspace
}: {
  workspace: HoursWorkspace
}): React.JSX.Element | null {
  const { years, year } = useTrackingYear(workspace)
  const [loaded, setLoaded] = useState<TrackingYear[]>([])
  const key = years.join(',')

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void Promise.all(years.map((start) => window.api.tracking.get(workspace, start))).then(
        (all) => !cancelled && setLoaded(all)
      )
    }
    load()
    const off = window.api.tracking.onChanged((event) => event.workspace === workspace && load())
    return () => {
      cancelled = true
      off()
    }
    // `key` stands for the list of years.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, key])

  if (loaded.length === 0) return null
  const rows = [...loaded].sort((a, b) => b.start.localeCompare(a.start))
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>Contracts</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Starts</th>
            <th scope="col">Ends</th>
            <th scope="col">Clients</th>
            <th scope="col">Hours a week</th>
            <th scope="col">Invoiced</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((contract) => (
            <ContractRow
              key={contract.start}
              contract={contract}
              current={contract.start === year}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
