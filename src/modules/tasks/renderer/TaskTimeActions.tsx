import { Play, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Select } from '@renderer/components/Select'
import { pushUndo } from '@renderer/components/undo-store'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useOpenContracts } from '@renderer/state/use-open-contracts'
import { QUARTER } from '@shared/tracking/rounding'
import { DurationField } from '../../hours/renderer/DurationField'
import { clientForTask } from '../../hours/shared/start-picker'
import { taskKey } from '../shared/tracked'
import type { Task, TaskWorkspace } from '../shared/types'
import styles from './TaskPage.module.css'

/**
 * The two ways to put time on a task: Start a timer on it, or Add time that was not tracked, on a day. One component for every
 * place that offers them (the task page's Time card, a training note), so a task is the same everywhere. Time lives in Hours; a
 * task only names it (`cc://task/<uid>`). When the task has subtasks (`parts`), Add time can go to one of them instead: a
 * series' trainings keep their own time. A task that does not exist yet (`uid` ''; a training's self-study) is made by `ensure` the
 * moment Start or Add time is pressed, and the time goes to the task it returns.
 */
export function TaskTimeActions({
  task,
  list,
  parts = [],
  workspace,
  isRunning,
  today,
  yearFor,
  clientFor,
  ensure
}: {
  task: Task
  /** The list that names the client: the task's own, or its parent's for a subtask. */
  list: string
  /** The open subtasks Add time may go to instead of the task itself. */
  parts?: readonly Task[]
  workspace: TaskWorkspace
  isRunning: boolean
  today: string
  yearFor: (date: string, client?: string) => string | null
  clientFor: (list: string, date: string) => string | undefined
  /** Makes the task when `task.uid` is ''; resolves with the task that exists. */
  ensure?: () => Promise<Task>
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(today)
  const [minutes, setMinutes] = useState(0)
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The clients to choose from when the task's list names none (nothing is guessed from the client used last).
  const startRef = useRef<HTMLButtonElement>(null)
  const { contracts } = useOpenContracts(workspace)

  const real = async (): Promise<Task> => (task.uid === '' && ensure ? await ensure() : task)

  const begin = async (client: string | undefined): Promise<void> => {
    setError(null)
    try {
      const made = await real()
      const result = await window.api.tracking.start(
        workspace,
        made.title,
        taskKey(made.uid),
        client
      )
      if (!result.ok) setError(`Couldn’t start the timer (${result.reason}).`)
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }
  const start = (): void => {
    void begin(clientForTask(contracts, list))
  }
  const add = async (): Promise<void> => {
    const client = clientFor(list, date)
    const year = yearFor(date, client)
    if (year === null) {
      setError('No year of Hours covers that day.')
      return
    }
    const quarter = Math.max(QUARTER, Math.round(minutes / QUARTER) * QUARTER)
    try {
      const goes = parts.find((p) => p.uid === target) ?? (await real())
      const result = await window.api.tracking.addTime(
        workspace,
        year,
        date,
        goes.title || 'Untitled',
        quarter,
        client,
        taskKey(goes.uid)
      )
      if (!result.ok) setError(`Couldn’t add the time (${result.reason}).`)
      else {
        // Cmd-Z takes back exactly this piece of time (it is the last one added).
        const added = result.year.adjusts[result.year.adjusts.length - 1]
        pushUndo({
          label: `added time on “${goes.title || 'Untitled'}”`,
          undo: async () => {
            const back = await window.api.tracking.removeAdjust(workspace, year, added.id)
            if (!back.ok) throw new Error('The time was changed since.')
          }
        })
        setAdding(false)
        setMinutes(0)
        setError(null)
      }
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }

  return (
    <>
      <div className={styles.timeButtons}>
        {!isRunning && (
          <Button
            ref={startRef}
            size="small"
            variant="primary"
            icon={<Play size={14} strokeWidth={1.75} aria-hidden />}
            onClick={start}
          >
            Start
          </Button>
        )}
        {!adding && (
          <Button
            size="small"
            icon={<Plus size={14} strokeWidth={1.75} aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add time
          </Button>
        )}
      </div>
      {adding && (
        <div
          className={styles.addTime}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setAdding(false)
          }}
        >
          {parts.length > 0 && (
            <Select
              compact
              label="For"
              search
              noun="subtasks"
              value={target}
              options={[
                { value: '', label: task.title || 'This task' },
                ...parts.map((p) => ({ value: p.uid, label: p.title }))
              ]}
              onChange={setTarget}
            />
          )}
          <input
            className={styles.dateInput}
            type="date"
            aria-label="Day"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value || today)}
          />
          <DurationField
            autoFocus
            label="Time"
            value={minutes}
            onChange={setMinutes}
            onEnter={() => void add()}
          />
          <Button size="small" variant="primary" disabled={minutes <= 0} onClick={() => void add()}>
            Add
          </Button>
          <Button size="small" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  )
}
