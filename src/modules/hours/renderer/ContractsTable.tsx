import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { DatePicker } from '@renderer/components/DatePicker'
import { FieldError } from '@renderer/components/FieldError'
import { Input } from '@renderer/components/Input'
import { Select } from '@renderer/components/Select'
import { showToast } from '@renderer/components/toast-store'
import { pushUndo, pushUndoWithToast } from '@renderer/components/undo-store'
import { useNewRowKeys } from '@renderer/components/useNewRowKeys'
import { ClientChips, ClientsField } from './ClientsField'
import { DurationField } from './DurationField'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatDate, todayIso } from '@shared/time'
import { contractIsEmpty } from '@shared/tracking/contracts'
import { clientRefusal } from '@shared/tracking/client-names'
import { contractEnd, contractWeeks } from '@shared/tracking/workspace-weeks'
import { invoiceOf, type Invoice, type TrackingYear } from '@shared/tracking/types'
import {
  clientChange,
  contractRefusal,
  formatAimHours,
  MAX_CONTRACT_NAME_LENGTH
} from '../shared/plan-settings'
import type { YearResult } from '@shared/tracking/api'
import type { HoursWorkspace } from '../shared/workspaces'
import styles from './ContractsTable.module.css'

const INVOICE_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' }
] as const

const ISO = /^\d{4}-\d{2}-\d{2}$/

const INVOICE_LABELS: Record<Invoice, string> = { week: 'Week', month: 'Month' }

function title(contract: TrackingYear): string {
  return contract.name ?? formatDate(contract.start)
}

function ContractRow({
  contract,
  workspace,
  known,
  editing,
  entering,
  onEdit,
  onDone,
  onDelete
}: {
  contract: TrackingYear
  workspace: HoursWorkspace
  known: readonly string[]
  editing: boolean
  /** Just added: flashed once to show where it landed. */
  entering: boolean
  onEdit: () => void
  onDone: () => void
  onDelete: () => void
}): React.JSX.Element {
  const end = contractEnd(contract)
  const [name, setName] = useState(contract.name ?? '')
  const [finish, setFinish] = useState(end)
  const [minutes, setMinutes] = useState(contract.plan.hoursPerWeek)
  const [invoice, setInvoice] = useState<Invoice>(invoiceOf(contract))
  const [newClients, setNewClients] = useState<string[]>(contract.plan.clients ?? [])
  const [problem, setProblem] = useState<string | null>(null)
  const savedClients = contract.plan.clients ?? []
  const label = title(contract)

  if (!editing)
    return (
      <tr className={entering ? styles.entering : undefined}>
        <th scope="row">{contract.name ?? '–'}</th>
        <td>{formatDate(contract.start)}</td>
        <td>{formatDate(end)}</td>
        <td className={styles.clients}>
          <ClientChips clients={savedClients} />
        </td>
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

  const cancel = (): void => {
    setName(contract.name ?? '')
    setFinish(end)
    setMinutes(contract.plan.hoursPerWeek)
    setInvoice(invoiceOf(contract))
    setNewClients(savedClients)
    setProblem(null)
    onDone()
  }
  const save = async (): Promise<void> => {
    if (name.trim() === '' || newClients.length === 0) return
    const api = window.api.tracking
    const results: YearResult[] = []
    // What Cmd-Z does, newest step first: each change that went through puts back what it replaced.
    const undoSteps: (() => Promise<{ ok: boolean }>)[] = []
    const change = clientChange(savedClients, newClients)
    if (change && 'rename' in change) {
      const { from, to } = change.rename
      const renamed = await api.renameClient(workspace, from, to)
      if (!renamed.ok) return setProblem(clientRefusal(renamed.reason))
      undoSteps.unshift(() => api.renameClient(workspace, to, from))
    }
    if (name.trim() !== (contract.name ?? '') || invoice !== invoiceOf(contract)) {
      const result = await api.setContractTerms(workspace, contract.start, { name, invoice })
      results.push(result)
      const old = { name: contract.name ?? '', invoice: invoiceOf(contract) }
      if (result.ok) undoSteps.unshift(() => api.setContractTerms(workspace, contract.start, old))
    }
    if (finish !== end && contractWeeks(contract.start, finish).ok) {
      const result = await api.setContractEnd(workspace, contract.start, finish)
      results.push(result)
      if (result.ok) undoSteps.unshift(() => api.setContractEnd(workspace, contract.start, end))
    }
    if (minutes !== contract.plan.hoursPerWeek) {
      const result = await api.setPlan(workspace, contract.start, { hoursPerWeek: minutes })
      results.push(result)
      const old = contract.plan.hoursPerWeek
      if (result.ok)
        undoSteps.unshift(() => api.setPlan(workspace, contract.start, { hoursPerWeek: old }))
    }
    if (change && 'set' in change) {
      const result = await api.setPlan(workspace, contract.start, { clients: change.set })
      results.push(result)
      if (result.ok)
        undoSteps.unshift(() => api.setPlan(workspace, contract.start, { clients: savedClients }))
    }
    if (undoSteps.length > 0) {
      pushUndo({
        label: `change to ${title(contract)}`,
        undo: async () => {
          for (const step of undoSteps) {
            const done = await step()
            if (!done.ok) return showToast('Couldn’t put the contract back.')
          }
        }
      })
    }
    const refused = results.find((result) => !result.ok)
    if (refused && !refused.ok)
      setProblem(
        refused.reason === 'client-has-tasks'
          ? clientRefusal(refused.reason, refused.detail?.client, refused.detail?.tasks)
          : contractRefusal(refused.reason)
      )
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
      <td>
        <ClientsField
          label={`Clients of ${label}`}
          clients={newClients}
          known={known}
          invalid={newClients.length === 0}
          onChange={(next) => {
            setNewClients(next)
            setProblem(null)
          }}
        />
      </td>
      <td>
        <DurationField
          label={`Hours a week of ${label}`}
          value={minutes}
          onChange={(next) => {
            setMinutes(next)
            setProblem(null)
          }}
          onEnter={() => void save()}
        />
      </td>
      <td>
        <Select
          label={`Invoiced for ${label}`}
          minWidth={120}
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

/** The row a new contract is typed into: it starts today and, until the last day is chosen, ends the same day (a contract is any length). */
function NewContractRow({
  workspace,
  known,
  onDone
}: {
  workspace: HoursWorkspace
  known: readonly string[]
  onDone: () => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [start, setStart] = useState(todayIso())
  const [chosenFinish, setChosenFinish] = useState<string | null>(null)
  const [clients, setClients] = useState<string[]>([])
  const [weeklyMinutes, setWeeklyMinutes] = useState(0)
  const [invoice, setInvoice] = useState<Invoice>('month')
  const [problem, setProblem] = useState<string | null>(null)
  const finish = chosenFinish ?? (ISO.test(start) ? start : '')
  const check = ISO.test(start) && ISO.test(finish) ? contractWeeks(start, finish) : null
  const ready = check?.ok === true && name.trim() !== '' && clients.length > 0
  const edit = (change: () => void): void => {
    change()
    setProblem(null)
  }
  const add = (): void => {
    if (!ready) return
    void window.api.tracking
      .createContract(workspace, start, finish, {
        name: name.trim(),
        clients,
        weeklyMinutes,
        invoice
      })
      .then((result) => {
        if (result.ok) onDone()
        else setProblem(contractRefusal(result.reason))
      })
  }

  return (
    <tr
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDone()
        if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) add()
      }}
    >
      <td>
        <Input
          autoFocus
          aria-label="Name"
          placeholder="Name"
          maxLength={MAX_CONTRACT_NAME_LENGTH}
          value={name}
          onChange={(event) => edit(() => setName(event.target.value))}
        />
        {problem && <FieldError message={problem} />}
      </td>
      <td>
        <DatePicker
          label="First day"
          placeholder="First day"
          value={start || null}
          today={todayIso()}
          full
          onChange={(day) =>
            edit(() => {
              setStart(day ?? '')
              // A chosen last day before the new first day is dropped.
              if (!day || (chosenFinish && !contractWeeks(day, chosenFinish).ok))
                setChosenFinish(null)
            })
          }
        />
      </td>
      <td>
        <DatePicker
          label="Last day"
          placeholder="Last day"
          value={finish || null}
          today={todayIso()}
          full
          isDisabled={(date) => !ISO.test(start) || !contractWeeks(start, date).ok}
          onChange={(day) => edit(() => setChosenFinish(day))}
        />
      </td>
      <td>
        <ClientsField
          label="Clients"
          clients={clients}
          known={known}
          onChange={(next) => edit(() => setClients(next))}
        />
      </td>
      <td>
        <DurationField
          label="Hours a week"
          value={weeklyMinutes}
          onChange={(next) => edit(() => setWeeklyMinutes(next))}
          onEnter={add}
        />
      </td>
      <td>
        <Select
          label="Invoiced"
          minWidth={120}
          value={invoice}
          options={INVOICE_OPTIONS}
          onChange={(next) => edit(() => setInvoice(next))}
        />
      </td>
      <td className={styles.actions}>
        <Button size="small" variant="primary" disabled={!ready} onClick={add}>
          Add
        </Button>
        <Button size="small" onClick={onDone}>
          Cancel
        </Button>
      </td>
    </tr>
  )
}

/** Every contract of a workspace, newest first; each row has Edit, and Delete while it holds no time. New contract adds a row at the top. */
export function ContractsTable({
  workspace
}: {
  workspace: HoursWorkspace
}): React.JSX.Element | null {
  const { years } = useTrackingYear(workspace)
  const [loaded, setLoaded] = useState<TrackingYear[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
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

  if (years.length > 0 && loaded.length === 0) return null
  const rows = [...loaded].sort((a, b) => b.start.localeCompare(a.start))
  const known = rows.flatMap((contract) => contract.plan.clients ?? [])

  const remove = (contract: TrackingYear): void => {
    void window.api.tracking.removeContract(workspace, contract.start).then((result) => {
      if (!result.ok) return showToast(contractRefusal(result.reason))
      pushUndoWithToast(`Removed ${title(contract)}.`, {
        label: `removal of ${title(contract)}`,
        undo: async () => {
          const added = await window.api.tracking.createContract(
            workspace,
            contract.start,
            contractEnd(contract),
            {
              ...(contract.name ? { name: contract.name } : {}),
              clients: contract.plan.clients ?? [],
              weeklyMinutes: contract.plan.hoursPerWeek,
              invoice: invoiceOf(contract)
            }
          )
          if (!added.ok) showToast('Couldn’t bring it back.')
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
            {adding && (
              <NewContractRow workspace={workspace} known={known} onDone={() => setAdding(false)} />
            )}
            {rows.map((contract) => (
              <ContractRow
                // Saved or restored, a contract is a new row, so a stale edit draft never carries over.
                key={JSON.stringify([
                  contract.start,
                  contract.name,
                  contract.weeks,
                  contract.end,
                  contract.invoice,
                  contract.plan.hoursPerWeek
                ])}
                contract={contract}
                workspace={workspace}
                known={known}
                editing={editing === contract.start}
                entering={entering.has(contract.start)}
                onEdit={() => setEditing(contract.start)}
                onDone={() => setEditing(null)}
                onDelete={() => remove(contract)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {!adding && (
        <div className={styles.footer}>
          <Button
            size="small"
            icon={<Plus size={14} strokeWidth={2} aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add contract
          </Button>
        </div>
      )}
    </section>
  )
}
