import { Link } from 'react-router'
import { Button } from '@renderer/components/Button'
import { Panel } from '@renderer/components/Panel'
import { taskRoute } from '../../tasks/renderer/tasks-paths'
import type { Task } from '../../tasks/shared/types'
import styles from './TrainingTask.module.css'

/**
 * The task a training's hours go to: its self-study task (made when Start or Add time is first pressed; the training's own task, the
 * session, is made and kept in step automatically by `useTrainingTask` and linked from the note's details). A note made before
 * trainings had tasks shows nothing. One whose training task was deleted says so and offers to make it again; nothing is remade by itself.
 */
export function TrainingTask({
  task,
  series,
  tasks,
  onRemake,
  selfStudy,
  draft,
  children
}: {
  /** The note's `task:` value. */
  task: string
  series: string | null
  tasks: readonly Task[] | null
  onRemake: () => void
  /** The training's self-study task, once it exists. */
  selfStudy?: Task
  /** The self-study task as it will be made, shown (not linked) until Start or Add time makes it. */
  draft: Task
  /** The training's hours, on the same line as its task. */
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
  const shown = selfStudy ?? draft
  const parent = shown.parentUid ? tasks.find((t) => t.uid === shown.parentUid) : undefined
  return (
    <Panel label="Task" row>
      <div className={styles.name}>
        {selfStudy ? (
          <Link className={styles.title} to={taskRoute(selfStudy.workspace, selfStudy.uid)}>
            {selfStudy.title}
          </Link>
        ) : (
          <span className={styles.plain}>{draft.title}</span>
        )}
        <span className={styles.list}>
          {parent ? `${parent.title} · ${parent.list}` : shown.list}
        </span>
      </div>
      {children}
    </Panel>
  )
}
