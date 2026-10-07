import { Play, Plus, Square } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Select } from '@renderer/components/Select'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useOpenContracts } from '@renderer/state/use-open-contracts'
import { QUARTER } from '@shared/tracking/rounding'
import { stopTimer } from '../../hours/renderer/start-request'
import { DurationField } from '../../hours/renderer/DurationField'
import { clientForTask } from '../../hours/shared/start-picker'
import { taskKey } from '../shared/tracked'
import type { Task, TaskWorkspace } from '../shared/types'
import styles from './TaskPage.module.css'

/**
 * The two ways to put time on a task: Start a timer on it, or Add time that was not tracked, on a day. One component for every
 * place that offers them (the task page's Time card, a training note), so a task is the same everywhere. Time lives in Hours; a
 * task only names it (`cc://task/<uid>`). When the task has subtasks (`parts`), Add time can go to one of them instead: a
 * series' lectures keep their own time.
 */
export function TaskTimeActions({
  task,
  list,
  parts = [],
  workspace,
  isRunning,
  today,
  yearFor,
  clientFor
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
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(today)
  const [minutes, setMinutes] = useState(0)
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The clients to choose from when the task's list names none (nothing is guessed from the client used last).
  const [asking, setAsking] = useState<string[] | null>(null)
  const startRef = useRef<HTMLButtonElement>(null)
  const { contracts } = useOpenContracts(workspace)

  const begin = async (client: string | undefined): Promise<void> => {
    setError(null)
    setAsking(null)
    const result = await window.api.tracking.start(workspace, task.title, taskKey(task.uid), client)
    if (!result.ok) setError(`Couldn’t start the timer (${result.reason}).`)
  }
  const start = (): void => {
    const found = clientForTask(contracts, list)
    if (found.ask) setAsking(found.ask)
    else void begin(found.client)
  }
  const stop = async (): Promise<void> => {
    await stopTimer()
  }
  const add = async (): Promise<void> => {
    const goes = parts.find((p) => p.uid === target) ?? task
    const client = clientFor(list, date)
    const year = yearFor(date, client)
    if (year === null) {
      setError('No year of Hours covers that day.')
      return
    }
    const quarter = Math.max(QUARTER, Math.round(minutes / QUARTER) * QUARTER)
    try {
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
        {isRunning ? (
          <Button
            size="small"
            variant="primary"
            icon={<Square size={14} strokeWidth={1.75} aria-hidden />}
            onClick={() => void stop()}
          >
            Stop
          </Button>
        ) : (
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
        <Button
          size="small"
          icon={<Plus size={14} strokeWidth={1.75} aria-hidden />}
          onClick={() => setAdding((open) => !open)}
        >
          Add time
        </Button>
      </div>
      {asking && !isRunning && (
        <div
          className={styles.ask}
          role="group"
          aria-label="Client"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              setAsking(null)
              startRef.current?.focus()
            }
          }}
        >
          <span className={styles.label}>Which client?</span>
          <div className={styles.timeButtons}>
            {asking.map((client, index) => (
              <Button
                key={client}
                size="small"
                autoFocus={index === 0}
                onClick={() => void begin(client)}
              >
                {client}
              </Button>
            ))}
          </div>
        </div>
      )}
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
