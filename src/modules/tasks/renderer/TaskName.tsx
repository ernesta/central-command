import type { Task } from '../shared/types'
import { studySeries } from '../shared/study-label'
import styles from './TaskName.module.css'

/** A task's title; a self-study subtask's with its series in front, muted: "Simulating Social Worlds › Day 2 self-study". */
export function TaskName({
  task,
  parent,
  title = task.title
}: {
  task: Task
  parent: Task | undefined
  /** What to show in place of the task's own title (Hours names a row for its day). */
  title?: React.ReactNode
}): React.JSX.Element {
  const series = studySeries(task, parent)
  return (
    <>
      {series && <span className={styles.series}>{series} › </span>}
      {title}
    </>
  )
}
