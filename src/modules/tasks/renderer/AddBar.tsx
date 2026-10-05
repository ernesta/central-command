import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { defaultList } from '../shared/query'
import type { TaskWorkspace } from '../shared/types'
import type { TaskRow } from '../shared/views'
import { DueField } from './DueField'
import { ListField } from './ListField'
import { useTaskDefaults } from './useTaskDefaults'
import styles from './AddBar.module.css'

/**
 * The bar above every list of tasks: type a title and press Enter. The due date starts as Today and the list as the one
 * being looked at, else the one used last. Priority is Normal; open the task, or use New task, to say more.
 */
export function AddBar({
  workspace,
  rows,
  today,
  listFilter = ''
}: {
  workspace: TaskWorkspace
  rows: readonly TaskRow[]
  today: string
  /** The list being looked at, as a list value; '' on a page that shows every list. */
  listFilter?: string
}): React.JSX.Element {
  const { last, remember } = useTaskDefaults(workspace)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<string | null>(today)
  // The person's own choice; until then the default follows the page and the tasks.
  const [chosen, setChosen] = useState<{ list: string; sublist: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const list = chosen ?? defaultList(rows, { filter: listFilter, last })

  const submit = async (): Promise<void> => {
    if (title.trim() === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.tasks.create({
        workspace,
        title: title.trim(),
        list: list.list,
        sublist: list.sublist,
        due
      })
      remember(list.list, list.sublist)
      setTitle('')
      inputRef.current?.focus()
    } catch (e) {
      setError(ipcErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className={styles.bar}
      aria-label="Add a task"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Plus size={16} strokeWidth={1.75} className={styles.plus} aria-hidden />
      <input
        ref={inputRef}
        className={styles.input}
        placeholder="Add a task"
        aria-label="Task title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <DueField value={due} today={today} onChange={setDue} />
      <ListField
        list={list.list}
        sublist={list.sublist}
        rows={rows}
        onChange={(value) => setChosen(value)}
      />
      <kbd className={styles.kbd}>Return</kbd>
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </form>
  )
}
