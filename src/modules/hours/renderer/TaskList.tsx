import { useState } from 'react'
import { Play, Square, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { Select } from '@renderer/components/Select'
import { showToast } from '@renderer/components/toast-store'
import { useNewRowKeys } from '@renderer/components/useNewRowKeys'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { formatHours } from '@shared/tracking/format'
import type { TaskRow } from '@shared/tracking/totals'
import { QUARTER } from '@shared/tracking/rounding'
import { DurationField } from './DurationField'
import styles from './TaskList.module.css'

interface TaskListProps {
  rows: readonly TaskRow[]
  /** Saves a task's time for the day, in minutes. */
  onSetMinutes: (label: string, minutes: number, client?: string) => void
  /** Renames a task for the day (the row's blocks and typed time with it). */
  /** `task` is the row's task (`cc://task/<uid>`), when it has one: renaming the row renames that task too. */
  onRename: (label: string, name: string, client?: string, task?: string) => void | Promise<void>
  /** The plan's clients (Work): each row then shows its client and offers the others. */
  clients?: readonly string[]
  /** Moves a row to another client (`from` is its client now). */
  onSetClient?: (label: string, from: string | undefined, to: string) => void
  /** Deletes a task's saved time for the day, once confirmed. Not offered for a running row or one with nothing to remove. */
  onDelete?: (label: string, client?: string) => void
  /** Start (or switch to) a task and stop it: given on Today only. */
  onStart?: (row: TaskRow) => void
  onStop?: () => void
  /** Whether starting is possible at all (not while an earlier day's timer waits for an end time). */
  canStart?: boolean
}

/** A row is a task and its client: the same name for two clients is two rows. */
function rowKey(row: TaskRow): string {
  return `${row.client ?? ''}\n${row.label}`
}

/** One row per task for a day: its time (click to type another) and, on Today, a round button to start or stop it. */
export function TaskList({
  rows,
  onSetMinutes,
  onRename,
  clients = [],
  onSetClient,
  onDelete,
  onStart,
  onStop,
  canStart = true
}: TaskListProps): React.JSX.Element | null {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState(0)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<TaskRow | null>(null)
  const [problem, setProblem] = useState('')
  const entering = useNewRowKeys(rows.map((row) => rowKey(row).toLowerCase()))
  if (rows.length === 0) return null

  const begin = (row: TaskRow): void => {
    setEditing(rowKey(row))
    setDraft(row.minutes)
  }
  // Reported time is whole quarter hours, so a typed 0:07 becomes 0:00 and 0:08 becomes 0:15.
  const commit = (row: TaskRow): void => {
    const typed = Math.round(draft / QUARTER) * QUARTER
    if (typed !== row.minutes) onSetMinutes(row.label, typed, row.client)
    setEditing(null)
  }
  const commitName = (row: TaskRow): void => {
    setProblem('')
    if (name.trim() && name.trim() !== row.label) {
      Promise.resolve(onRename(row.label, name, row.client, row.task)).catch((e: unknown) =>
        setProblem(ipcErrorMessage(e))
      )
    }
    setRenaming(null)
  }

  return (
    <>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li
            key={rowKey(row).toLowerCase()}
            className={[styles.row, entering.has(rowKey(row).toLowerCase()) && styles.entering]
              .filter(Boolean)
              .join(' ')}
            data-live={row.running}
          >
            {onStart && onStop && (
              <button
                type="button"
                className={styles.round}
                aria-label={
                  row.running ? `Stop ${row.label || 'task'}` : `Start ${row.label || 'task'}`
                }
                disabled={!row.running && !canStart}
                onClick={() => (row.running ? onStop() : onStart(row))}
              >
                {row.running ? (
                  <Square size={12} strokeWidth={1.75} fill="currentColor" aria-hidden />
                ) : (
                  <Play size={12} strokeWidth={1.75} fill="currentColor" aria-hidden />
                )}
              </button>
            )}
            {renaming === rowKey(row) ? (
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
                  setRenaming(rowKey(row))
                  setName(row.label)
                }}
              >
                {row.label || 'No task yet'}
              </button>
            )}
            {clients.length > 0 && onSetClient && (
              <Select
                compact
                className={styles.client}
                label={`Client of ${row.label || 'task'}`}
                value={row.client ?? ''}
                options={[
                  ...(row.client === undefined ? [{ value: '', label: 'No client' }] : []),
                  ...clients.map((c) => ({ value: c, label: c }))
                ]}
                onChange={(to) => to && onSetClient(row.label, row.client, to)}
              />
            )}
            <span className={styles.end}>
              {row.running ? (
                <span className={styles.time}>{formatHours(row.minutes)}</span>
              ) : editing === rowKey(row) ? (
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
              {onDelete &&
                (row.running || !row.removable ? (
                  <span className={styles.delete} aria-hidden />
                ) : (
                  <button
                    type="button"
                    className={styles.delete}
                    aria-label={`Delete ${row.label || 'task'}`}
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                  </button>
                ))}
            </span>
          </li>
        ))}
      </ul>
      {problem && (
        <p role="alert" className={styles.problem}>
          {problem}
        </p>
      )}
      {deleting && onDelete && (
        <Dialog
          title="Delete this time?"
          onCancel={() => setDeleting(null)}
          actions={
            <>
              <Button size="small" onClick={() => setDeleting(null)} autoFocus>
                Cancel
              </Button>
              <Button
                size="small"
                variant="danger"
                onClick={() => {
                  const { label, client, minutes } = deleting
                  onDelete(label, client)
                  setDeleting(null)
                  showToast(`Deleted “${label || 'Untitled'}” (${formatHours(minutes)}).`, {
                    label: 'Undo',
                    run: () => onSetMinutes(label, minutes, client)
                  })
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          {formatHours(deleting.minutes)} on {deleting.label || 'No task yet'} will be removed from
          this day, and from the task&apos;s tracked time.
        </Dialog>
      )}
    </>
  )
}
