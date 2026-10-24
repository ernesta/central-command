import { GraduationCap } from 'lucide-react'
import type { Task } from '../shared/types'
import { studyName } from '../shared/study-label'
import styles from './TaskName.module.css'

/** The mark of a task shown as a training: Lucide's cap, muted, 14px. Home's training rows use the same one. */
export function StudyIcon(): React.JSX.Element {
  return <GraduationCap size={14} strokeWidth={1.75} className={styles.icon} aria-hidden />
}

/**
 * A task's name. A self-study task is shown as its training ("Simulating Social Worlds: Day 2") with a cap in front; any other
 * task shows its title.
 */
export function TaskName({
  task,
  parent,
  title
}: {
  task: Task
  parent: Task | undefined
  /** What to show in place of the name (the picker highlights what was typed in it). */
  title?: React.ReactNode
}): React.JSX.Element {
  const study = studyName(task, parent)
  return (
    <>
      {study !== null && <StudyIcon />}
      {title ?? study ?? task.title}
    </>
  )
}
