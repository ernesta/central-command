import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Input } from '@renderer/components/Input'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { formatDate } from '@shared/time'
import { addDays, yearEnd } from '@shared/year'
import { contractWeeks, dayAfterContract } from '@shared/tracking/workspace-weeks'
import type { HoursWorkspace } from '../shared/workspaces'
import styles from './ContractFields.module.css'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Where the next contract would start: the day after the latest one ends, nothing yet when there is none. */
function nextStart(latest: { start: string; weeks?: number } | null): string {
  return latest ? dayAfterContract(latest.start, latest.weeks ?? 52) : ''
}

/**
 * Work's contracts. The latest one's last day can be moved (a contract is whole weeks: it starts on a Friday and ends on
 * a Thursday); a new one is added with its first and last day.
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
    !contractWeeks(workspace, current.start, shownEnd).ok

  const changeEnd = (value: string): void => {
    setEndDraft({ for: end, value })
    if (
      current &&
      ISO.test(value) &&
      value !== end &&
      contractWeeks(workspace, current.start, value).ok
    )
      void window.api.tracking.setContractEnd(workspace, current.start, value)
  }

  const [start, setStart] = useState('')
  const [finish, setFinish] = useState('')
  const suggested = nextStart(current)
  const from = start || suggested
  const check = ISO.test(from) && ISO.test(finish) ? contractWeeks(workspace, from, finish) : null
  const add = (): void => {
    if (!check?.ok) return
    void window.api.tracking.createContract(workspace, from, finish).then((result) => {
      if (result.ok) {
        setStart('')
        setFinish('')
      }
    })
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
        <div className={styles.row} role="group" aria-labelledby="new-contract-label">
          <Input
            className={styles.date}
            type="date"
            aria-label="First day"
            value={from}
            aria-invalid={
              (ISO.test(from) && check?.ok === false && check.reason === 'bad-start') || undefined
            }
            onChange={(event) => setStart(event.target.value)}
          />
          <Input
            className={styles.date}
            type="date"
            aria-label="Last day"
            value={finish}
            aria-invalid={(check?.ok === false && check.reason === 'bad-end') || undefined}
            onChange={(event) => setFinish(event.target.value)}
          />
          <Button variant="secondary" disabled={!check?.ok} onClick={add}>
            Add
          </Button>
        </div>
      </div>
    </>
  )
}
