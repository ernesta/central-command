import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { DatePicker } from '@renderer/components/DatePicker'
import { Dialog } from '@renderer/components/Dialog'
import { FieldError } from '@renderer/components/FieldError'
import { Input } from '@renderer/components/Input'
import { Select } from '@renderer/components/Select'
import { showToast } from '@renderer/components/toast-store'
import { useNewRowKeys } from '@renderer/components/useNewRowKeys'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatDate, todayIso } from '@shared/time'
import { yearEnd } from '@shared/year'
import { contractIsEmpty } from '@shared/tracking/contracts'
import { contractWeeks } from '@shared/tracking/workspace-weeks'
import { invoiceOf, type Invoice, type TrackingYear } from '@shared/tracking/types'
import {
  contractRefusal,
  formatAimHours,
  MAX_CONTRACT_NAME_LENGTH,
  parseContractHours
} from '../shared/plan-settings'
import type { YearResult } from '@shared/tracking/api'
import type { HoursWorkspace } from '../shared/workspaces'
import styles from './ContractsTable.module.css'

const INVOICE_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' }
] as const

const INVOICE_LABELS: Record<Invoice, string> = { week: 'Week', month: 'Month' }

function title(contract: TrackingYear): string {
  return contract.name ?? formatDate(contract.start)
}

function ContractRow({
  contract,
  workspace,
  editing,
  entering,
  onEdit,
  onDone,
  onDelete
}: {
  contract: TrackingYear
  workspace: HoursWorkspace
  editing: boolean
  /** Just added: flashed once to show where it landed. */
  entering: boolean
  onEdit: () => void
  onDone: () => void
  onDelete: () => void
}): React.JSX.Element {
  const end = yearEnd(contract.start, contract.weeks)
  const [name, setName] = useState(contract.name ?? '')
  const [finish, setFinish] = useState(end)
  const [hours, setHours] = useState(formatAimHours(contract.plan.hoursPerWeek))
  const [invoice, setInvoice] = useState<Invoice>(invoiceOf(contract))
  const [problem, setProblem] = useState<string | null>(null)
  const clients = (contract.plan.clients ?? []).join(', ') || '–'
  const label = title(contract)

  if (!editing)
    return (
      <tr className={entering ? styles.entering : undefined}>
        <th scope="row">{contract.name ?? '–'}</th>
        <td>{formatDate(contract.start)}</td>
        <td>{formatDate(end)}</td>
        <td className={styles.clients}>{clients}</td>
        <td>{formatAimHours(contract.plan.hoursPerWeek)}</td>
        <td>{INVOICE_LABELS[invoiceOf(contract)]}</td>
        <td className={styles.actions}>
          <Button size="small" aria-label={`Edit ${label}`} onClick={onEdit}>
            Edit
          </Button>
          {contractIsEmpty(contract) && (
            <Button size="small" aria-label={`Delete ${label}`} onClick={onDelete}>
              Delete
            </Button>
          )}
        </td>
      </tr>
    )

  const weeklyMinutes = parseContractHours(hours)
  const cancel = (): void => {
    setName(contract.name ?? '')
    setFinish(end)
    setHours(formatAimHours(contract.plan.hoursPerWeek))
    setInvoice(invoiceOf(contract))
    setProblem(null)
    onDone()
  }
  const save = async (): Promise<void> => {
    if (name.trim() === '' || weeklyMinutes === null) return
    const api = window.api.tracking
    const results: YearResult[] = []
    if (name.trim() !== (contract.name ?? '') || invoice !== invoiceOf(contract))
      results.push(await api.setContractTerms(workspace, contract.start, { name, invoice }))
    if (finish !== end && contractWeeks(contract.start, finish).ok)
      results.push(await api.setContractEnd(workspace, contract.start, finish))
    if (weeklyMinutes !== contract.plan.hoursPerWeek)
      results.push(await api.setPlan(workspace, contract.start, { hoursPerWeek: weeklyMinutes }))
    const refused = results.find((result) => !result.ok)
    if (refused && !refused.ok) setProblem(contractRefusal(refused.reason))
    else onDone()
  }
  return (
    <tr
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel()
        if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) void save()
      }}
    >
      <td>
        <Input
          autoFocus
          aria-label={`Name of ${label}`}
          maxLength={MAX_CONTRACT_NAME_LENGTH}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setProblem(null)
          }}
        />
        {problem && <FieldError message={problem} />}
      </td>
      <td>{formatDate(contract.start)}</td>
      <td>
        <DatePicker
          label={`Ends of ${label}`}
          value={finish}
          today={todayIso()}
          full
          clearable={false}
          isDisabled={(date) => !contractWeeks(contract.start, date).ok}
          onChange={(day) => {
            if (day) setFinish(day)
            setProblem(null)
          }}
        />
      </td>
      <td className={styles.clients}>{clients}</td>
      <td>
        <Input
          inputMode="numeric"
          aria-label={`Hours a week of ${label}`}
          aria-invalid={weeklyMinutes === null || undefined}
          value={hours}
          onChange={(event) => {
            setHours(event.target.value)
            setProblem(null)
          }}
        />
      </td>
      <td>
        <Select
          label={`Invoiced for ${label}`}
          value={invoice}
          options={INVOICE_OPTIONS}
          onChange={setInvoice}
        />
      </td>
      <td className={styles.actions}>
        <Button size="small" variant="primary" onClick={() => void save()}>
          Save
        </Button>
        <Button size="small" onClick={cancel}>
          Cancel
        </Button>
      </td>
    </tr>
  )
}

/** Every contract of a workspace, newest first; each row has Edit, and Delete while it holds no time. */
export function ContractsTable({
  workspace
}: {
  workspace: HoursWorkspace
}): React.JSX.Element | null {
  const { years } = useTrackingYear(workspace)
  const [loaded, setLoaded] = useState<TrackingYear[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<TrackingYear | null>(null)
  const key = years.join(',')
  const entering = useNewRowKeys(loaded.map((contract) => contract.start))

  useEffect(() => {
    let cancelled = false
    const load = (): void => {
      void Promise.all(years.map((start) => window.api.tracking.get(workspace, start))).then(
        (all) => {
          if (!cancelled) setLoaded(all)
        }
      )
    }
    load()
    const off = window.api.tracking.onChanged((event) => {
      if (event.workspace === workspace) load()
    })
    return () => {
      cancelled = true
      off()
    }
    // `key` stands for the list of years.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, key])

  if (loaded.length === 0) return null
  const rows = [...loaded].sort((a, b) => b.start.localeCompare(a.start))

  const remove = (contract: TrackingYear): void => {
    setDeleting(null)
    void window.api.tracking.removeContract(workspace, contract.start).then((result) => {
      if (!result.ok) return showToast(contractRefusal(result.reason))
      showToast(`Removed ${title(contract)}.`, {
        label: 'Undo',
        run: () => {
          const weeks = contract.weeks ?? 52
          void window.api.tracking
            .createContract(workspace, contract.start, yearEnd(contract.start, weeks), {
              ...(contract.name ? { name: contract.name } : {}),
              clients: contract.plan.clients ?? [],
              weeklyMinutes: contract.plan.hoursPerWeek,
              invoice: invoiceOf(contract)
            })
            .then((added) => {
              if (!added.ok) showToast('Couldn’t bring it back.')
            })
        }
      })
    })
  }

  return (
    <section className={styles.card} aria-label="Contracts">
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Starts</th>
              <th scope="col">Ends</th>
              <th scope="col">Clients</th>
              <th scope="col">Hours a week</th>
              <th scope="col">Invoiced</th>
              <th scope="col">
                <span className={styles.hidden}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((contract) => (
              <ContractRow
                // Saved or restored, a contract is a new row, so a stale edit draft never carries over.
                key={JSON.stringify([
                  contract.start,
                  contract.name,
                  contract.weeks,
                  contract.invoice,
                  contract.plan.hoursPerWeek
                ])}
                contract={contract}
                workspace={workspace}
                editing={editing === contract.start}
                entering={entering.has(contract.start)}
                onEdit={() => setEditing(contract.start)}
                onDone={() => setEditing(null)}
                onDelete={() => setDeleting(contract)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {deleting && (
        <Dialog
          title="Remove this contract?"
          onCancel={() => setDeleting(null)}
          actions={
            <>
              <Button size="small" onClick={() => setDeleting(null)} autoFocus>
                Cancel
              </Button>
              <Button size="small" variant="danger" onClick={() => remove(deleting)}>
                Delete
              </Button>
            </>
          }
        >
          {title(deleting)} holds no time, and will be removed.
        </Dialog>
      )}
    </section>
  )
}
