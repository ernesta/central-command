import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Segmented } from '@renderer/components/Segmented'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { defaultList, tagsIn } from '../shared/query'
import { splitTitleTags } from '../shared/title-tags'
import { canUseList } from '../shared/work-lists'
import { type TaskPriority, type TaskWorkspace } from '../shared/types'
import type { TaskRow } from '../shared/views'
import { DueField } from './DueField'
import { ListField } from './ListField'
import { TagsField } from './TagsField'
import { PRIORITY_OPTIONS } from './task-labels'
import { useWorkClients } from './useWorkClients'
import { useTaskDefaults } from './useTaskDefaults'
import styles from './AddBar.module.css'

/**
 * A bar for adding a task in one line: type a title, set what matters, press Add (or Enter). The due date starts as Today and the list as the one
 * being looked at, else the one used last; priority starts Normal and tags empty.
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
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [tags, setTags] = useState<string[]>([])
  // The person's own choice; until then the default follows the page and the tasks.
  const [chosen, setChosen] = useState<{ list: string; sublist: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const clients = useWorkClients(workspace)
  // A list chosen earlier that is no longer a client (renamed or removed meanwhile) gives way to the default.
  const picked = chosen && canUseList(workspace, chosen.list, clients ?? []) ? chosen : null
  const list = picked ?? defaultList(rows, { filter: listFilter, last, clients })

  const submit = async (): Promise<void> => {
    const typed = splitTitleTags(title)
    if (typed.title === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.tasks.create({
        workspace,
        title: typed.title,
        list: list.list,
        sublist: list.sublist,
        due,
        priority,
        tags: [...new Set([...tags, ...typed.tags])]
      })
      remember(list.list, list.sublist)
      setTitle('')
      setPriority('normal')
      setTags([])
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
        placeholder="Add a task (#tag to tag it)"
        aria-label="Task title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <DueField value={due} today={today} onChange={setDue} />
      <ListField
        workspace={workspace}
        list={list.list}
        sublist={list.sublist}
        rows={rows}
        onChange={(value) => setChosen(value)}
      />
      <Segmented<TaskPriority>
        label="Priority"
        value={priority}
        options={PRIORITY_OPTIONS}
        onChange={setPriority}
      />
      <TagsField tags={tags} suggestions={tagsIn(rows)} onChange={setTags} />
      <Button type="submit" variant="primary" disabled={busy || splitTitleTags(title).title === ''}>
        Add
      </Button>
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </form>
  )
}
