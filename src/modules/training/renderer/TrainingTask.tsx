import { ListChecks } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { IconButton } from '@renderer/components/IconButton'
import { Panel } from '@renderer/components/Panel'
import { taskRoute } from '../../tasks/renderer/tasks-paths'
import type { Task } from '../../tasks/shared/types'
import styles from './TrainingTask.module.css'

/**
 * The training's self-study tracking: a "Self-study" card with the hours, Start and Add time, and an icon that opens the self-study task
 * once it exists (made when Start or Add time is first pressed; the training's own task, the session, is made and kept in step
 * automatically by `useTrainingTask` and opened from the note's details). A note made before
 * trainings had tasks shows nothing. One whose training task was deleted says so and offers to make it again; nothing is remade by itself.
 */
export function TrainingTask({
  task,
  series,
  tasks,
  onRemake,
  selfStudy,
  children
}: {
  /** The note's `task:` value. */
  task: string
  series: string | null
  tasks: readonly Task[] | null
  onRemake: () => void
  /** The training's self-study task, once it exists. */
  selfStudy?: Task
  /** The training's hours, on the same line as its task. */
  children?: React.ReactNode
}): React.JSX.Element | null {
  const navigate = useNavigate()
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
  return (
    <Panel
      label="Self-study"
      row
      actions={
        selfStudy && (
          <IconButton
            label="Open self-study task"
            onClick={() => void navigate(taskRoute(selfStudy.workspace, selfStudy.uid))}
          >
            <ListChecks size={16} strokeWidth={1.75} aria-hidden />
          </IconButton>
        )
      }
    >
      {children}
    </Panel>
  )
}
