import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { Select } from '@renderer/components/Select'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { cleanName, deriveGroups, isValidName, nameKey } from '@modules/notes/shared/groups'
import { listValue } from '../shared/query'
import type { TaskWorkspace } from '../shared/types'
import type { TaskRow } from '../shared/views'
import { tasksAllRoute } from './tasks-paths'
import styles from './NewTaskDialog.module.css'

/**
 * "New list": a list exists only through its tasks, so the dialog asks for the name (and, for a sublist, the list it sits
 * inside) and the first task. Research only: Work's lists are its clients.
 */
export function NewListDialog({
  workspace,
  rows,
  today,
  onClose
}: {
  workspace: TaskWorkspace
  rows: readonly TaskRow[]
  today: string
  onClose: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [inside, setInside] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const groups = deriveGroups(rows.map((r) => ({ group: r.task.list, subgroup: r.task.sublist })))
  const clean = cleanName(name)
  const taken = (inside ? (groups.find((g) => g.name === inside)?.subgroups ?? []) : groups).some(
    (g) => nameKey(g.name) === nameKey(clean)
  )
  const problem =
    clean === ''
      ? null
      : !isValidName(clean)
        ? 'Use a shorter name, without / or ›.'
        : taken
          ? 'That list exists already.'
          : null
  const ready = clean !== '' && problem === null && title.trim() !== ''

  const add = async (): Promise<void> => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    const list = inside || clean
    const sublist = inside ? clean : ''
    try {
      await window.api.tasks.create({
        workspace,
        title: title.trim(),
        list,
        sublist,
        due: today,
        priority: 'normal',
        tags: []
      })
      onClose()
      navigate(tasksAllRoute(workspace, { list: listValue(list, sublist) }))
    } catch (e) {
      setError(ipcErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title="New list"
      onCancel={onClose}
      busy={busy}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void add()} disabled={busy || !ready}>
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
          <span className={styles.label}>List</span>
          <input
            className={styles.title}
            autoFocus
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className={styles.field}>
          <span className={styles.label}>Inside</span>
          <Select
            label="Inside"
            value={inside}
            options={[
              { value: '', label: 'None' },
              ...groups.map((g) => ({ value: g.name, label: g.name }))
            ]}
            onChange={setInside}
          />
        </div>
        <label className={styles.field}>
          <span className={styles.label}>First task</span>
          <input
            className={styles.title}
            placeholder="What needs doing?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        {(problem || error) && (
          <p role="alert" className={styles.error}>
            {problem ?? error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
