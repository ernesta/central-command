import { formatHours } from '@shared/tracking/format'
import { HoursLine } from '../../meetings/renderer/MeetingHoursNote'
import { TaskTimeActions } from '../../tasks/renderer/TaskTimeActions'
import { todayIso } from '../../tasks/renderer/tasks-paths'
import { useTaskTime } from '../../tasks/renderer/useTaskTime'
import type { Task } from '../../tasks/shared/types'
import { lectureTaskUid } from '../shared/lecture-entries'
import type { TrainingMeta } from '../shared/types'
import styles from './LectureHours.module.css'
import { draftSelfStudyTask } from './self-study-sync'
import { useSelfStudy } from './useSelfStudy'

/**
 * A lecture's self-study hours, laid out for the one-line Task card: one total (the time tracked on the self-study task, 0 until something is put
 * on it; the session is not in it), Start and Add time on that task (the session itself is typed in the note, so it has none;
 * the task is made when one of them is pressed), and, only when there is something to say, an overlap or a missing time. Shown once
 * the lecture has its task.
 */
export function LectureHours({
  meta,
  tasks,
  ensure
}: {
  meta: TrainingMeta
  tasks: readonly Task[] | null
  /** Makes the self-study task (`useSelfStudyTask`). */
  ensure: () => Promise<Task>
}): React.JSX.Element | null {
  const selfStudy = useSelfStudy()
  const time = useTaskTime('research')
  const uid = lectureTaskUid(meta.task)
  const own = uid ? tasks?.find((t) => t.uid === uid) : undefined
  if (!uid || !own) return null
  const study = meta.selfStudy ? tasks?.find((t) => t.uid === meta.selfStudy) : undefined
  const task = study ?? draftSelfStudyTask(meta)
  const parent = task.parentUid ? tasks?.find((t) => t.uid === task.parentUid) : undefined
  // This task's own time (0 until something is put on it), not the lecture's session.
  const total = meta.selfStudy ? (selfStudy.get(meta.selfStudy) ?? 0) : 0
  return (
    <>
      <div className={styles.total}>
        <b>{formatHours(total)}</b>
        <span>on this task</span>
      </div>
      <div className={styles.actions}>
        <TaskTimeActions
          task={task}
          list={parent?.list ?? task.list}
          workspace="research"
          isRunning={study ? time.running.has(study.uid) : false}
          today={todayIso()}
          yearFor={time.yearFor}
          clientFor={time.clientFor}
          ensure={ensure}
        />
      </div>
      <div className={styles.note}>
        <HoursLine meta={{ ...meta, task: uid }} />
      </div>
    </>
  )
}
