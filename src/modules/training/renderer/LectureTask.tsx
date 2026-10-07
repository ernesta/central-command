import { Button } from '@renderer/components/Button'
import type { Task } from '../../tasks/shared/types'
import styles from '../../meetings/renderer/MeetingTask.module.css'

/**
 * The task a lecture's hours belong to, shown (it is made and kept in step automatically, `useLectureTask`). A note made before
 * lectures had tasks shows nothing. One whose task was deleted says so and offers to make it again; nothing is remade by itself.
 */
export function LectureTask({
  task,
  series,
  tasks,
  onRemake
}: {
  /** The note's `task:` value. */
  task: string
  series: string | null
  tasks: readonly Task[] | null
  onRemake: () => void
}): React.JSX.Element | null {
  if (!task || tasks === null) return null
  if (task === 'auto') {
    return (
      <div className={styles.row}>
        <span className={styles.list}>
          {series ? 'Making the task…' : 'Choose a series and the task is made.'}
        </span>
      </div>
    )
  }
  const own = tasks.find((t) => t.uid === task)
  if (!own) {
    return (
      <div className={styles.row}>
        <span className={styles.list}>The task was deleted.</span>
        <Button size="small" onClick={onRemake}>
          Make it again
        </Button>
      </div>
    )
  }
  const parent = own.parentUid ? tasks.find((t) => t.uid === own.parentUid) : undefined
  return (
    <div className={styles.row}>
      <span className={styles.value}>
        <span className={styles.title}>{own.title}</span>
        <span className={styles.list}>
          {parent ? `${parent.title} · ${parent.list}` : own.list}
        </span>
      </span>
    </div>
  )
}
