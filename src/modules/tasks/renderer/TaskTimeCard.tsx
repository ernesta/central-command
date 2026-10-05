import { Play, Plus, Square } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { QUARTER } from '@shared/tracking/rounding'
import { DurationField } from '../../hours/renderer/DurationField'
import { formatTaskTime } from '../shared/query'
import { taskKey } from '../shared/tracked'
import type { Task, TaskWorkspace } from '../shared/types'
import type { TaskTime } from '../shared/views'
import styles from './TaskPage.module.css'

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
  yearFor
}: {
  task: Task
  workspace: TaskWorkspace
  time: TaskTime
  own: TaskTime
  isRunning: boolean
  today: string
  yearFor: (date: string) => string | null
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(today)
  const [minutes, setMinutes] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const start = async (): Promise<void> => {
    setError(null)
    const result = await window.api.tracking.start(workspace, task.title, taskKey(task.uid))
    if (!result.ok) setError(`Couldn’t start the timer (${result.reason}).`)
  }
  const stop = async (): Promise<void> => {
    const result = await window.api.tracking.stop()
    if (!result.ok) setError(`Couldn’t stop the timer (${result.reason}).`)
  }
  const add = async (): Promise<void> => {
    const year = yearFor(date)
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
        undefined,
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
      <div className={styles.timeLine}>
        <span>Earlier, from ClickUp</span>
        <span>{formatTaskTime(own.earlier) || '0:00'}</span>
      </div>
      <div className={styles.timeLine}>
        <span>In Hours</span>
        <span>{formatTaskTime(own.tracked) || '0:00'}</span>
      </div>
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
            size="small"
            variant="primary"
            icon={<Play size={14} strokeWidth={1.75} aria-hidden />}
            onClick={() => void start()}
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
