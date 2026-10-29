import { useToday } from '@renderer/state/use-today'
import { formatHours } from '@shared/tracking/format'
import { TaskTimeActions } from '../../tasks/renderer/TaskTimeActions'
import { useTaskTime } from '../../tasks/renderer/useTaskTime'
import type { Task } from '../../tasks/shared/types'
import { trainingTaskUid } from '../shared/training-entries'
import type { TrainingMeta } from '../shared/types'
import styles from './TrainingHours.module.css'
import { draftSelfStudyTask } from './self-study-sync'
import { useSelfStudy } from './useSelfStudy'

/**
 * A training's self-study hours, laid out for the one-line Task card: one total (the time tracked on the self-study task, 0 until something is put
 * on it; the session is not in it), Start and Add time on that task (the session itself is typed in the note, so it has none;
 * the task is made when one of them is pressed), and, only when there is something to say, an overlap or a missing time. Shown once
 * the training has its task.
 */
export function TrainingHours({
  meta,
  tasks,
  ensure,
  workspace = 'research'
}: {
  meta: TrainingMeta
  tasks: readonly Task[] | null
  /** Makes the self-study task (`useSelfStudyTask`). */
  ensure: () => Promise<Task>
  /** Life's entries have no session task: only the self-study one. */
  workspace?: 'research' | 'life'
}): React.JSX.Element | null {
  const today = useToday()
  const selfStudy = useSelfStudy(workspace)
  const time = useTaskTime(workspace)
  const uid = trainingTaskUid(meta.task)
  const own = uid ? tasks?.find((t) => t.uid === uid) : undefined
  if (workspace === 'research' && (!uid || !own)) return null
  const study = meta.selfStudy ? tasks?.find((t) => t.uid === meta.selfStudy) : undefined
  const task = study ?? draftSelfStudyTask(meta, workspace)
  const parent = task.parentUid ? tasks?.find((t) => t.uid === task.parentUid) : undefined
  // This task's own time (0 until something is put on it), not the training's session.
  // A running timer's minutes so far are in it (`time.tracked`), so the figure moves while it runs.
  const total = study ? (time.tracked.get(study.uid) ?? selfStudy.get(study.uid) ?? 0) : 0
  return (
    <>
      <div className={styles.total}>
        <b>{formatHours(total)}</b>
      </div>
      <div className={styles.actions}>
        <TaskTimeActions
          task={task}
          list={parent?.list ?? task.list}
          workspace={workspace}
          isRunning={study ? time.running.has(study.uid) : false}
          today={today}
          yearFor={time.yearFor}
          clientFor={time.clientFor}
          ensure={ensure}
        />
      </div>
    </>
  )
}
