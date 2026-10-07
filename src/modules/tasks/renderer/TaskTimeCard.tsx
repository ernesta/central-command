import { Play, Plus, Square } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useOpenContracts } from '@renderer/state/use-open-contracts'
import { QUARTER } from '@shared/tracking/rounding'
import { stopTimer } from '../../hours/renderer/start-request'
import { DurationField } from '../../hours/renderer/DurationField'
import { clientForTask } from '../../hours/shared/start-picker'
import { formatTaskTime } from '../shared/query'
import { taskKey } from '../shared/tracked'
import type { Task, TaskWorkspace } from '../shared/types'
import type { TaskTime } from '../shared/views'
import styles from './TaskPage.module.css'

const monthLabel = (month: string): string =>
  new Date(`${month}-01T00:00:00Z`).toLocaleString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })

/**
 * The side panel's time: the total (this task's, with its subtasks), ClickUp's earlier time and Hours' time apart, and the two
 * ways to add to it: Start a timer on the task, or Add time that was not tracked, on a day. Time lives in Hours; a task only
 * names it (`cc://task/<uid>`).
 */
export function TaskTimeCard({
  task,
  workspace,
  time,
  own,
  isRunning,
  today,
  yearFor,
  clientFor,
  months
}: {
  task: Task
  workspace: TaskWorkspace
  time: TaskTime
  own: TaskTime
  isRunning: boolean
  today: string
  yearFor: (date: string, client?: string) => string | null
  /** The list of this task as a client of a contract that holds the date, when its name is one. */
  clientFor: (list: string, date: string) => string | undefined
  /** Every hour on this task by month (history included); the two lines below it are for a task with none. */
  months: { month: string; minutes: number }[]
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(today)
  const [minutes, setMinutes] = useState(0)
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
    const found = clientForTask(contracts, task.list)
    if (found.ask) setAsking(found.ask)
    else void begin(found.client)
  }
  const stop = async (): Promise<void> => {
    await stopTimer()
  }
  const add = async (): Promise<void> => {
    const client = clientFor(task.list, date)
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
        task.title || 'Untitled',
        quarter,
        client,
        taskKey(task.uid)
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
    <section className={styles.box} aria-label="Time">
      <div className={styles.timeRow}>
        <span className={styles.label}>Time on this task</span>
        <b className={styles.total}>{formatTaskTime(time.total) || '0:00'}</b>
      </div>
      {months.length > 0 ? (
        months.map((m) => (
          <div key={m.month} className={styles.timeLine}>
            <span>{monthLabel(m.month)}</span>
            <span>{formatTaskTime(m.minutes)}</span>
          </div>
        ))
      ) : (
        <>
          <div className={styles.timeLine}>
            <span>Earlier, from ClickUp</span>
            <span>{formatTaskTime(own.earlier) || '0:00'}</span>
          </div>
          <div className={styles.timeLine}>
            <span>In Hours</span>
            <span>{formatTaskTime(own.tracked) || '0:00'}</span>
          </div>
        </>
      )}
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
    </section>
  )
}
