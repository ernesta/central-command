import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LandingBox, LandingSection } from '@renderer/components/Landing'
import { findMentions } from '@shared/entities'
import { formatDue, listLabel } from '../shared/query'
import type { Task } from '../shared/types'
import { allTasks } from './task-cache'
import { taskRoute, todayIso } from './tasks-paths'
import styles from './PersonTasks.module.css'

/** The tasks not done whose description mentions a person, soonest due first. Nothing is shown when there are none. */
export function PersonTasks({ name }: { name: string }): React.JSX.Element | null {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    let cancelled = false
    void allTasks(true).then((all) => {
      if (cancelled) return
      setTasks(
        all
          .filter(
            (t) =>
              t.status !== 'done' &&
              findMentions(t.description).some((m) => m.ref.kind === 'person' && m.ref.key === name)
          )
          .sort((a, b) =>
            a.due === b.due
              ? a.title.localeCompare(b.title)
              : a.due === null
                ? 1
                : b.due === null
                  ? -1
                  : a.due.localeCompare(b.due)
          )
      )
    })
    return () => {
      cancelled = true
    }
  }, [name])

  if (tasks.length === 0) return null
  const today = todayIso()
  return (
    <LandingSection id="person-tasks" label={`Open tasks · ${tasks.length}`}>
      <LandingBox>
        <ul className={styles.list}>
          {tasks.map((t) => (
            <li key={t.uid}>
              <Link className={styles.row} to={taskRoute(t.workspace, t.uid)}>
                <span>{t.title || 'Untitled'}</span>
                <span className={styles.meta}>
                  {[
                    t.parentUid ? '' : listLabel(t.list, t.sublist),
                    t.due ? formatDue(t.due, today) : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </LandingBox>
    </LandingSection>
  )
}
