import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { FieldError } from '@renderer/components/FieldError'
import { Input } from '@renderer/components/Input'
import { Segmented } from '@renderer/components/Segmented'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatDate } from '@shared/time'
import { addDays, yearEnd } from '@shared/year'
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
 * Work's contracts. The latest one's last day can be moved (a contract is whole weeks from its own first day, whatever
 * weekday); a new one is added with its first and last day.
 */
export function ContractFields({ workspace }: { workspace: HoursWorkspace }): React.JSX.Element {
  const { data } = useTrackingYear(workspace)
  // The contract shown (this one's last day can be moved).
  const current = data
  const end = current ? yearEnd(current.start, current.weeks) : ''

  const [endDraft, setEndDraft] = useState<{ for: string; value: string } | null>(null)
  const shownEnd = endDraft?.for === end ? endDraft.value : end
  const endRefused =
    current !== null &&
    ISO.test(shownEnd) &&
    shownEnd !== end &&
    !contractWeeks(current.start, shownEnd).ok

  const changeEnd = (value: string): void => {
    setEndDraft({ for: end, value })
    if (current && ISO.test(value) && value !== end && contractWeeks(current.start, value).ok)
      void window.api.tracking.setContractEnd(workspace, current.start, value)
  }

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
      {current && (
        <>
          <div className={styles.field}>
            <span className={styles.label} id="contract-start-label">
              Contract starts
            </span>
            <output aria-labelledby="contract-start-label">{formatDate(current.start)}</output>
          </div>
          <div className={styles.field}>
            <label htmlFor="contract-end" className={styles.label}>
              Contract ends
            </label>
            <Input
              id="contract-end"
              className={styles.date}
              type="date"
              value={shownEnd}
              min={addDays(current.start, 6)}
              aria-invalid={endRefused || undefined}
              onChange={(event) => changeEnd(event.target.value)}
              onBlur={() => setEndDraft(null)}
            />
          </div>
        </>
      )}
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
            <Input
              className={styles.date}
              type="date"
              aria-label="First day"
              value={from}
              aria-invalid={
                (ISO.test(from) && check?.ok === false && check.reason === 'bad-start') || undefined
              }
              onChange={(event) => edit(() => setStart(event.target.value))}
            />
            <Input
              className={styles.date}
              type="date"
              aria-label="Last day"
              value={finish}
              aria-invalid={(check?.ok === false && check.reason === 'bad-end') || undefined}
              onChange={(event) => edit(() => setFinish(event.target.value))}
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
