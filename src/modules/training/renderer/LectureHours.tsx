import { formatHours } from '@shared/tracking/format'
import { MeetingHoursNote } from '../../meetings/renderer/MeetingHoursNote'
import { TaskTimeActions } from '../../tasks/renderer/TaskTimeActions'
import { todayIso } from '../../tasks/renderer/tasks-paths'
import { useTaskTime } from '../../tasks/renderer/useTaskTime'
import type { Task } from '../../tasks/shared/types'
import { lectureTaskUid } from '../shared/lecture-entries'
import { entryMinutes } from '../shared/rules'
import type { TrainingMeta } from '../shared/types'
import styles from './LectureHours.module.css'
import { useSelfStudy } from './useSelfStudy'

/**
 * A lecture's hours: one total (its own session from the note's times, plus everything tracked on its task, no split), Start and
 * Add time on the lecture's task (the same ones every task has), and, only when there is something to say, an overlap or a
 * missing time. Shown once the lecture has its task.
 */
export function LectureHours({
  id,
  meta,
  tasks
}: {
  id: string
  meta: TrainingMeta
  tasks: readonly Task[] | null
}): React.JSX.Element | null {
  const selfStudy = useSelfStudy()
  const time = useTaskTime('research')
  const uid = lectureTaskUid(meta.task)
  const own = uid ? tasks?.find((t) => t.uid === uid) : undefined
  if (!uid || !own) return null
  const parent = own.parentUid ? tasks?.find((t) => t.uid === own.parentUid) : undefined
  const total = entryMinutes(meta, selfStudy) ?? 0
  return (
    <div className={styles.box}>
      <div className={styles.total}>
        <b>{formatHours(total)}</b>
        <span>in total</span>
      </div>
      <div>
        <TaskTimeActions
          task={own}
          list={parent?.list ?? own.list}
          workspace="research"
          isRunning={time.running.has(own.uid)}
          today={todayIso()}
          yearFor={time.yearFor}
          clientFor={time.clientFor}
        />
      </div>
      <MeetingHoursNote
        workspace="research"
        id={id}
        meta={{ ...meta, task: uid }}
        kind="training"
      />
    </div>
  )
}
