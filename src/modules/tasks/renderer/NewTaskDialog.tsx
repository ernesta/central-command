import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { Segmented } from '@renderer/components/Segmented'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { defaultList } from '../shared/query'
import { TASK_PRIORITIES, type TaskPriority, type TaskWorkspace } from '../shared/types'
import type { TaskRow } from '../shared/views'
import { DueField } from './DueField'
import { ListField } from './ListField'
import { PRIORITY_LABELS } from './task-labels'
import { useTaskDefaults } from './useTaskDefaults'
import styles from './NewTaskDialog.module.css'

/** The small dialog behind every "New task" button and the shortcut: title, due, list and priority. */
export function NewTaskDialog({
  workspace,
  rows,
  today,
  listFilter,
  onClose
}: {
  workspace: TaskWorkspace
  rows: readonly TaskRow[]
  today: string
  listFilter: string
  onClose: () => void
}): React.JSX.Element {
  const { last, remember } = useTaskDefaults(workspace)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<string | null>(today)
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [chosen, setChosen] = useState<{ list: string; sublist: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const list = chosen ?? defaultList(rows, { filter: listFilter, last })

  const add = async (): Promise<void> => {
    if (title.trim() === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.tasks.create({
        workspace,
        title: title.trim(),
        list: list.list,
        sublist: list.sublist,
        due,
        priority
      })
      remember(list.list, list.sublist)
      onClose()
    } catch (e) {
      setError(ipcErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="New task"
      onCancel={onClose}
      busy={busy}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void add()}
            disabled={busy || title.trim() === ''}
          >
            Add
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Task</span>
          <input
            className={styles.title}
            autoFocus
            placeholder="What needs doing?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.label}>Due</span>
            <DueField value={due} today={today} onChange={setDue} />
          </div>
          <div className={styles.field}>
            <span className={styles.label}>List</span>
            <ListField list={list.list} sublist={list.sublist} rows={rows} onChange={setChosen} />
          </div>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Priority</span>
          <Segmented<TaskPriority>
            label="Priority"
            value={priority}
            options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
            onChange={setPriority}
          />
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {/* Enter in the title adds the task. */}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
