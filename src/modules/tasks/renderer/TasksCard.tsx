import { Link } from 'react-router'
import { isBacklog, isOpen } from '../shared/views'
import { effectiveDue } from '../shared/views'
import { tasksBase, todayIso, useTasksWorkspace } from './tasks-paths'
import { useTasksList } from './useTasksList'
import styles from './TasksCard.module.css'

/** The Tasks entry on a workspace's landing page. The title is a real link whose hit area covers the whole card. */
export function TasksCard(): React.JSX.Element {
  const workspace = useTasksWorkspace()
  const { rows } = useTasksList(workspace)
  const today = todayIso()
  const open = rows ? rows.filter((r) => isOpen(r) || isBacklog(r)).length : 0
  const overdue = rows
    ? rows.filter((r) => {
        const due = effectiveDue(r.task, r.kids)
        return r.task.status !== 'done' && due !== null && due < today
      }).length
    : 0

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        <Link className={styles.link} to={tasksBase(workspace)}>
          Tasks
        </Link>
      </h2>
      {rows === null ? null : open === 0 ? (
        <p className={styles.line}>No open tasks</p>
      ) : (
        <>
          <p className={styles.line}>{open} open</p>
          <p className={styles.line}>{overdue === 0 ? 'None overdue' : `${overdue} overdue`}</p>
        </>
      )}
    </div>
  )
}
