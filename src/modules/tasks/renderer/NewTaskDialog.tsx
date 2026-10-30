import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { Segmented } from '@renderer/components/Segmented'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { defaultList, tagsIn } from '../shared/query'
import { splitTitleTags } from '../shared/title-tags'
import { canUseList } from '../shared/work-lists'
import { type TaskPriority, type TaskWorkspace } from '../shared/types'
import type { TaskRow } from '../shared/views'
import type { NewTaskRequest } from './new-task-store'
import { DueField } from './DueField'
import { ListField } from './ListField'
import { TagsField } from './TagsField'
import { useWorkClients } from './useWorkClients'
import { PRIORITY_OPTIONS } from './task-labels'
import { useTaskDefaults } from './useTaskDefaults'
import styles from './NewTaskDialog.module.css'

/** The small dialog behind every "New task" button and the shortcut: title, due, list, priority and tags. */
export function NewTaskDialog({
  workspace,
  rows,
  today,
  listFilter,
  request,
  onClose
}: {
  workspace: TaskWorkspace
  rows: readonly TaskRow[]
  today: string
  listFilter: string
  /** What the dialog was opened with: a title, a due date, a description and a Watch item to start from. */
  request?: NewTaskRequest
  onClose: () => void
}): React.JSX.Element {
  const { last, remember } = useTaskDefaults(workspace)
  const [title, setTitle] = useState(request?.title ?? '')
  const [due, setDue] = useState<string | null>(request?.due !== undefined ? request.due : today)
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [tags, setTags] = useState<string[]>([])
  const [chosen, setChosen] = useState<{ list: string; sublist: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const clients = useWorkClients(workspace)
  // A list chosen earlier that is no longer a client (renamed or removed meanwhile) gives way to the default.
  const picked = chosen && canUseList(workspace, chosen.list, clients ?? []) ? chosen : null
  const list = picked ?? defaultList(rows, { filter: listFilter, last, clients })

  const add = async (): Promise<void> => {
    const typed = splitTitleTags(title)
    if (typed.title === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      const made = await window.api.tasks.create({
        workspace,
        title: typed.title,
        list: list.list,
        sublist: list.sublist,
        due,
        priority,
        tags: [...new Set([...tags, ...typed.tags])],
        ...(request?.description ? { description: request.description } : {}),
        ...(request?.watchItem
          ? { watchItemId: request.watchItem.id, watchUrl: request.watchItem.url }
          : {})
      })
      remember(list.list, list.sublist)
      request?.onCreated?.(made)
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
            disabled={busy || splitTitleTags(title).title === ''}
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
            placeholder="What needs doing? Add #tags in the title"
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
            <ListField
              workspace={workspace}
              list={list.list}
              sublist={list.sublist}
              rows={rows}
              onChange={setChosen}
            />
          </div>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Priority</span>
          <Segmented<TaskPriority>
            label="Priority"
            value={priority}
            options={PRIORITY_OPTIONS}
            onChange={setPriority}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Tags</span>
          <TagsField tags={tags} suggestions={tagsIn(rows)} onChange={setTags} />
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
