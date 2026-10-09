import { formatTaskTime } from '../shared/query'
import type { Task, TaskWorkspace } from '../shared/types'
import type { TaskTime } from '../shared/views'
import { TaskTimeActions } from './TaskTimeActions'
import styles from './TaskPage.module.css'

const monthLabel = (month: string): string =>
  new Date(`${month}-01T00:00:00Z`).toLocaleString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })

/**
 * The side panel's time: the total (this task's, with its subtasks), ClickUp's older time (when it has any) and each month's tracked time apart, and the two
 * ways to add to it (`TaskTimeActions`).
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
  months,
  list,
  parts
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
  /** Every hour on this task by month (history included); a task with none shows this month at 0:00. */
  months: { month: string; minutes: number }[]
  /** The list that names the client (the task's own). */
  list: string
  /** The open subtasks Add time may go to. */
  parts: readonly Task[]
}): React.JSX.Element {
  return (
    <section className={styles.box} aria-label="Time">
      <div className={styles.timeRow}>
        <span className={styles.label}>Time on this task</span>
        <b className={styles.total}>{formatTaskTime(time.total) || '0:00'}</b>
      </div>
      {own.earlier > 0 && (
        <div className={styles.timeLine}>
          <span>Earlier</span>
          <span>{formatTaskTime(own.earlier)}</span>
        </div>
      )}
      {months.length > 0 ? (
        months.map((m) => (
          <div key={m.month} className={styles.timeLine}>
            <span>{monthLabel(m.month)}</span>
            <span>{formatTaskTime(m.minutes)}</span>
          </div>
        ))
      ) : (
        <div className={styles.timeLine}>
          <span>{monthLabel(today.slice(0, 7))}</span>
          <span>0:00</span>
        </div>
      )}
      <TaskTimeActions
        task={task}
        list={list}
        parts={parts}
        workspace={workspace}
        isRunning={isRunning}
        today={today}
        yearFor={yearFor}
        clientFor={clientFor}
      />
    </section>
  )
}
