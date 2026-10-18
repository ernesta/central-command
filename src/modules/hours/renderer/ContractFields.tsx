import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { DatePicker } from '@renderer/components/DatePicker'
import { FieldError } from '@renderer/components/FieldError'
import { Input } from '@renderer/components/Input'
import { Segmented } from '@renderer/components/Segmented'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { todayIso } from '@shared/time'
import { contractWeeks, dayAfterContract } from '@shared/tracking/workspace-weeks'
import type { Invoice } from '@shared/tracking/types'
import {
  contractRefusal,
  MAX_CONTRACT_NAME_LENGTH,
  parseClientList,
  parseContractHours
} from '../shared/plan-settings'
import type { HoursWorkspace } from '../shared/workspaces'
import styles from './ContractFields.module.css'

const ISO = /^\d{4}-\d{2}-\d{2}$/

const INVOICE_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' }
] as const

/** Where the next contract would start: the day after the latest one ends, nothing yet when there is none. */
function nextStart(latest: { start: string; weeks?: number } | null): string {
  return latest ? dayAfterContract(latest.start, latest.weeks ?? 52) : ''
}

/**
 * Adding a Work contract: its first and last day are whole weeks from the first (whatever weekday); the table above
 * edits the ones made.
 */
export function ContractFields({ workspace }: { workspace: HoursWorkspace }): React.JSX.Element {
  const { data } = useTrackingYear(workspace)
  const current = data
  const today = todayIso()

  const [start, setStart] = useState('')
  const [finish, setFinish] = useState('')
  const [name, setName] = useState('')
  const [clientsText, setClientsText] = useState('')
  const [hoursText, setHoursText] = useState('')
  const [invoice, setInvoice] = useState<Invoice>('month')
  const [refused, setRefused] = useState<string | null>(null)
  const suggested = nextStart(current)
  const from = start || suggested
  const check = ISO.test(from) && ISO.test(finish) ? contractWeeks(from, finish) : null
  const clients = parseClientList(clientsText)
  const weeklyMinutes = parseContractHours(hoursText)
  const ready =
    check?.ok === true && name.trim() !== '' && clients !== null && weeklyMinutes !== null
  const add = (): void => {
    if (!ready || !clients || weeklyMinutes === null) return
    void window.api.tracking
      .createContract(workspace, from, finish, {
        name: name.trim(),
        clients,
        weeklyMinutes,
        invoice
      })
      .then((result) => {
        if (result.ok) {
          setStart('')
          setFinish('')
          setName('')
          setClientsText('')
          setHoursText('')
          setInvoice('month')
          setRefused(null)
        } else setRefused(contractRefusal(result.reason))
      })
  }
  const edit = (change: () => void): void => {
    change()
    setRefused(null)
  }

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label} id="new-contract-label">
          {current ? 'New contract' : 'Contract'}
        </span>
        <div className={styles.group} role="group" aria-labelledby="new-contract-label">
          <Input
            aria-label="Name"
            placeholder="Name"
            maxLength={MAX_CONTRACT_NAME_LENGTH}
            value={name}
            onChange={(event) => edit(() => setName(event.target.value))}
          />
          <div className={styles.row}>
            <DatePicker
              label="First day"
              placeholder="First day"
              value={from || null}
              today={today}
              full
              onChange={(day) =>
                edit(() => {
                  setStart(day ?? '')
                  // A last day that no longer makes whole weeks from the new first day is dropped.
                  if (!day || !contractWeeks(day, finish).ok) setFinish('')
                })
              }
            />
            <DatePicker
              label="Last day"
              placeholder="Last day"
              value={finish || null}
              today={today}
              full
              isDisabled={(date) => !ISO.test(from) || !contractWeeks(from, date).ok}
              onChange={(day) => edit(() => setFinish(day ?? ''))}
            />
          </div>
          <Input
            aria-label="Clients"
            placeholder="Clients, separated by commas"
            aria-invalid={(clientsText.trim() !== '' && clients === null) || undefined}
            value={clientsText}
            onChange={(event) => edit(() => setClientsText(event.target.value))}
          />
          <div className={styles.row}>
            <Input
              className={styles.hours}
              inputMode="numeric"
              aria-label="Weekly hours"
              placeholder="Weekly hours"
              aria-invalid={weeklyMinutes === null || undefined}
              value={hoursText}
              onChange={(event) => edit(() => setHoursText(event.target.value))}
            />
            <Segmented
              label="Invoiced"
              value={invoice}
              options={INVOICE_OPTIONS}
              onChange={(next) => edit(() => setInvoice(next))}
            />
            <Button variant="secondary" disabled={!ready} onClick={add}>
              Add
            </Button>
          </div>
          {refused && <FieldError message={refused} />}
        </div>
      </div>
    </>
  )
}
