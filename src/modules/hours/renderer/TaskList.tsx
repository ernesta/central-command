import { useState } from 'react'
import { Play, Square } from 'lucide-react'
import { formatHours } from '@shared/tracking/format'
import type { TaskRow } from '@shared/tracking/totals'
import { QUARTER } from '@shared/tracking/rounding'
import { DurationField } from './DurationField'
import styles from './TaskList.module.css'

interface TaskListProps {
  rows: readonly TaskRow[]
  /** Saves a task's time for the day, in minutes. */
  onSetMinutes: (label: string, minutes: number) => void
  /** Renames a task for the day (the row's blocks and typed time with it). */
  onRename: (label: string, name: string) => void
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
  onRename,
  onStart,
  onStop,
  canStart = true
}: TaskListProps): React.JSX.Element | null {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState(0)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')
  if (rows.length === 0) return null

  const begin = (row: TaskRow): void => {
    setEditing(row.label)
    setDraft(row.minutes)
  }
  // Reported time is whole quarter hours, so a typed 0:07 becomes 0:00 and 0:08 becomes 0:15.
  const commit = (row: TaskRow): void => {
    const typed = Math.round(draft / QUARTER) * QUARTER
    if (typed !== row.minutes) onSetMinutes(row.label, typed)
    setEditing(null)
  }
  const commitName = (row: TaskRow): void => {
    if (name.trim() && name.trim() !== row.label) onRename(row.label, name)
    setRenaming(null)
  }

  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <li key={row.label.toLowerCase()} className={styles.row} data-live={row.running}>
          {onStart && onStop && (
            <button
              type="button"
              className={styles.round}
              aria-label={
                row.running ? `Stop ${row.label || 'task'}` : `Start ${row.label || 'task'}`
              }
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
          {renaming === row.label ? (
            <input
              className={styles.rename}
              aria-label={`Name of ${row.label || 'task'}`}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value.replace(/[\r\n]/g, ''))}
              onFocus={(event) => event.target.select()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitName(row)
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  setRenaming(null)
                }
              }}
              onBlur={() => commitName(row)}
            />
          ) : (
            <button
              type="button"
              className={styles.nameButton}
              data-empty={row.label === '' || undefined}
              aria-label={`Rename ${row.label || 'task'}`}
              onClick={() => {
                setRenaming(row.label)
                setName(row.label)
              }}
            >
              {row.label || 'No name yet'}
            </button>
          )}
          {row.running ? (
            <span className={styles.time}>{formatHours(row.minutes)}</span>
          ) : editing === row.label ? (
            <DurationField
              autoFocus
              label={`Time on ${row.label || 'task'}`}
              value={draft}
              onChange={setDraft}
              onEnter={() => commit(row)}
              onEscape={() => setEditing(null)}
              onBlur={() => commit(row)}
            />
          ) : (
            <button
              type="button"
              className={styles.timeButton}
              aria-label={`Edit time on ${row.label || 'task'}`}
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
