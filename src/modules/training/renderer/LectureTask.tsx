import { Link } from 'react-router'
import { Button } from '@renderer/components/Button'
import { Panel } from '@renderer/components/Panel'
import { taskRoute } from '../../tasks/renderer/tasks-paths'
import type { Task } from '../../tasks/shared/types'
import styles from './LectureTask.module.css'

/**
 * The task a lecture's hours belong to, shown (it is made and kept in step automatically, `useLectureTask`). A note made before
 * lectures had tasks shows nothing. One whose task was deleted says so and offers to make it again; nothing is remade by itself.
 */
export function LectureTask({
  task,
  series,
  tasks,
  onRemake,
  children
}: {
  /** The note's `task:` value. */
  task: string
  series: string | null
  tasks: readonly Task[] | null
  onRemake: () => void
  /** The lecture's hours, on the same line as its task. */
  children?: React.ReactNode
}): React.JSX.Element | null {
  if (!task || tasks === null) return null
  if (task === 'auto') {
    return (
      <Panel label="Task" row>
        <div className={styles.row}>
          <span className={styles.list}>
            {series ? 'Making the task…' : 'Give it a title and the task is made.'}
          </span>
        </div>
      </Panel>
    )
  }
  const own = tasks.find((t) => t.uid === task)
  if (!own) {
    return (
      <Panel label="Task" row>
        <div className={styles.row}>
          <span className={styles.list}>The task was deleted.</span>
          <Button size="small" onClick={onRemake}>
            Make it again
          </Button>
        </div>
      </Panel>
    )
  }
  const parent = own.parentUid ? tasks.find((t) => t.uid === own.parentUid) : undefined
  return (
    <Panel label="Task" row>
      <div className={styles.name}>
        <Link className={styles.title} to={taskRoute(own.workspace, own.uid)}>
          {own.title}
        </Link>
        <span className={styles.list}>
          {parent ? `${parent.title} · ${parent.list}` : own.list}
        </span>
      </div>
      {children}
    </Panel>
  )
}
