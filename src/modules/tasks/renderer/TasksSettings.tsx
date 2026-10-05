import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { formatDate } from '@shared/time'
import { listLabel } from '../shared/query'
import type { Task } from '../shared/types'
import styles from './TasksSettings.module.css'

type Trashed = { task: Task; deletedAt: string }

/**
 * Settings → Tasks: the deleted tasks, each with Restore (deleting never removes anything), and a readable copy of every task
 * on demand (one is also written the first time the app starts each day, in the data folder's `backups/tasks`).
 */
export function TasksSettings(): React.JSX.Element {
  const [trash, setTrash] = useState<Trashed[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    void window.api.tasks.trash().then((list) => {
      if (!cancelled) setTrash(list)
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  const restore = async (uid: string): Promise<void> => {
    try {
      await window.api.tasks.restore(uid)
      setMessage(null)
      setReload((n) => n + 1)
    } catch (e) {
      setMessage(`Couldn’t restore it: ${ipcErrorMessage(e)}`)
    }
  }
  const copy = async (): Promise<void> => {
    try {
      setMessage(`Saved ${await window.api.tasks.snapshot()} in the backups folder.`)
    } catch (e) {
      setMessage(`Couldn’t save a copy: ${ipcErrorMessage(e)}`)
    }
  }

  return (
    <section className={styles.section} aria-label="Tasks">
      <h3 className={styles.heading}>Deleted tasks</h3>
      {trash === null ? null : trash.length === 0 ? (
        <p className={styles.none}>None.</p>
      ) : (
        <ul className={styles.list}>
          {trash.map(({ task, deletedAt }) => (
            <li key={task.uid} className={styles.row}>
              <span className={styles.title}>{task.title || 'Untitled'}</span>
              <span className={styles.meta}>
                {task.parentUid ? 'Subtask' : listLabel(task.list, task.sublist)} · deleted{' '}
                {formatDate(deletedAt.slice(0, 10))}
              </span>
              <Button size="small" onClick={() => void restore(task.uid)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
      <h3 className={styles.heading}>Copy</h3>
      <div>
        <Button size="small" onClick={() => void copy()}>
          Save a copy now
        </Button>
      </div>
      {message && (
        <p role="status" className={styles.none}>
          {message}
        </p>
      )}
    </section>
  )
}
