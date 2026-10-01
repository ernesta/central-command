import { useState } from 'react'
import { Play, Square } from 'lucide-react'
import { formatHours } from '@shared/tracking/format'
import type { TaskRow } from '@shared/tracking/totals'
import { parseQuarterHours } from '../shared/tasks'
import styles from './TaskList.module.css'

interface TaskListProps {
  rows: readonly TaskRow[]
  /** Saves a task's time for the day, in minutes. */
  onSetMinutes: (label: string, minutes: number) => void
  /** Start (or switch to) a task and stop it: given on Today only. */
  onStart?: (label: string) => void
  onStop?: () => void
  /** Whether starting is possible at all (not while an earlier day's timer waits for an end time). */
  canStart?: boolean
}

/** One row per task for a day: its time (click to type another) and, on Today, a round button to start or stop it. */
export function TaskList({
  rows,
  onSetMinutes,
  onStart,
  onStop,
  canStart = true
}: TaskListProps): React.JSX.Element | null {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  if (rows.length === 0) return null

  const begin = (row: TaskRow): void => {
    setEditing(row.label)
    setDraft(formatHours(row.minutes))
  }
  const typed = parseQuarterHours(draft)
  const commit = (row: TaskRow): void => {
    if (typed !== null && typed !== row.minutes) onSetMinutes(row.label, typed)
    setEditing(null)
  }

  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <li key={row.label.toLowerCase()} className={styles.row} data-live={row.running}>
          {onStart && onStop && (
            <button
              type="button"
              className={styles.round}
              aria-label={row.running ? `Stop ${row.label}` : `Start ${row.label}`}
              disabled={!row.running && !canStart}
              onClick={() => (row.running ? onStop() : onStart(row.label))}
            >
              {row.running ? (
                <Square size={12} strokeWidth={1.75} fill="currentColor" aria-hidden />
              ) : (
                <Play size={12} strokeWidth={1.75} fill="currentColor" aria-hidden />
              )}
            </button>
          )}
          <span className={styles.name}>{row.label}</span>
          {row.running ? (
            <span className={styles.time}>{formatHours(row.minutes)}</span>
          ) : editing === row.label ? (
            <input
              className={styles.edit}
              aria-label={`Time on ${row.label}`}
              aria-invalid={typed === null || undefined}
              inputMode="numeric"
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.target.select()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commit(row)
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  setEditing(null)
                }
              }}
              onBlur={() => commit(row)}
            />
          ) : (
            <button
              type="button"
              className={styles.timeButton}
              aria-label={`Edit time on ${row.label}`}
              onClick={() => begin(row)}
            >
              {formatHours(row.minutes)}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
