import { useEffect, useState, useSyncExternalStore } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { Segmented } from '@renderer/components/Segmented'
import { pushUndoWithToast } from '@renderer/components/undo-store'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import { MentionedIn } from '@renderer/entities/MentionedIn'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { registerFlushable } from '@renderer/lib/flush-registry'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import { EditorCard } from '@renderer/notes/EditorCard'
import { tagsIn } from '../shared/query'
import { TASK_STATUSES, type Task, type TaskChanges, type TaskWorkspace } from '../shared/types'
import { subtaskProgress, taskTime, type TaskRow } from '../shared/views'
import { DebouncedSaver } from './debounced-saver'
import { DueField } from './DueField'
import { ListField } from './ListField'
import { deletedMessage, setTaskStatus, STATUS_LABELS, updateTaskUndoable } from './task-actions'
import { PRIORITY_OPTIONS } from './task-labels'
import { StatusIcon } from './TaskIcons'
import { RecurrenceField } from './RecurrenceField'
import { TagsField } from './TagsField'
import { TasksTable } from './TasksTable'
import { TaskTimeCard } from './TaskTimeCard'
import { taskRoute, todayIso, useTasksWorkspace } from './tasks-paths'
import { useTaskTime } from './useTaskTime'
import { useTasksList } from './useTasksList'
import { useSessionTaskUids } from './useSessionTaskUids'
import styles from './TaskPage.module.css'

/** One task's page: its title, status, priority, due date and list, its subtasks, its description, and its time. */
export function TaskPage(): React.JSX.Element {
  const workspace = useTasksWorkspace()
  const { uid = '' } = useParams()
  const { tasks, rows } = useTasksList(workspace)
  if (tasks === null || rows === null) return <div className={styles.page} />
  const task = tasks.find((t) => t.uid === uid)
  if (!task) {
    return (
      <div className={styles.page}>
        <EmptyState heading="Task not found" message="It may have been deleted." />
      </div>
    )
  }
  // A subtask has no page of its own: everything about it is set on its parent's page.
  const parent = task.parentUid ? tasks.find((t) => t.uid === task.parentUid) : undefined
  if (parent) return <Navigate replace to={taskRoute(workspace, parent.uid)} />
  const row = rows.find((r) => r.task.uid === task.uid)
  return (
    <TaskView
      key={task.uid}
      task={task}
      row={row ?? { task, kids: [] }}
      rows={rows}
      workspace={workspace}
    />
  )
}

function useSaver(
  initial: string,
  save: (text: string) => Promise<void>
): { saver: DebouncedSaver; state: ReturnType<DebouncedSaver['getSnapshot']> } {
  const [saver] = useState(() => new DebouncedSaver(initial, save))
  const state = useSyncExternalStore(saver.subscribe, saver.getSnapshot)
  useEffect(() => {
    const unregister = registerFlushable(() => saver.flush())
    return () => {
      unregister()
      // Leaving the page writes what is still pending.
      void saver.flush()
    }
  }, [saver])
  return { saver, state }
}

function TaskView({
  task,
  row,
  rows,
  workspace
}: {
  task: Task
  row: TaskRow
  rows: readonly TaskRow[]
  workspace: TaskWorkspace
}): React.JSX.Element {
  const navigate = useNavigate()
  const today = todayIso()
  const { tracked, running, yearFor, clientFor, months } = useTaskTime(workspace)
  const sessionTasks = useSessionTaskUids(workspace)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (changes: TaskChanges): void => {
    setError(null)
    updateTaskUndoable(task, changes, 'task change').catch((e: unknown) =>
      setError(ipcErrorMessage(e))
    )
  }

  const { saver: title, state: titleState } = useSaver(task.title, async (text) => {
    await window.api.tasks.update(task.uid, { title: text })
  })
  const { saver: description, state: descriptionState } = useSaver(
    task.description,
    async (text) => {
      await window.api.tasks.update(task.uid, { description: text })
    }
  )
  const [titleText, setTitleText] = useState(task.title)
  const [bodyText, setBodyText] = useState(task.description)
  const [startBody] = useState(task.description)
  useDocumentTitle(titleText)

  const time = taskTime(row, tracked)
  const own = taskTime({ task, kids: [] }, tracked)
  const progress = subtaskProgress(row.kids)
  // Leaving after a delete goes where the visitor came from, as Back does.
  const leave = (): void => void navigate(-1)

  const remove = async (): Promise<void> => {
    setBusy(true)
    try {
      await Promise.all([title.flush(), description.flush()])
      const untouched =
        title.current === '' && description.current.trim() === '' && row.kids.length === 0
      if (untouched && (await window.api.tasks.discardIfEmpty(task.uid))) {
        leave()
        return
      }
      const minutes = await window.api.tasks.delete(task.uid)
      leave()
      pushUndoWithToast(deletedMessage(title.current, minutes), {
        label: `deletion of “${title.current || 'Untitled'}”`,
        undo: async () => {
          await window.api.tasks.restore(task.uid)
        }
      })
    } catch (e) {
      setError(ipcErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Button size="small" variant="danger-outline" disabled={busy} onClick={() => void remove()}>
          Delete task
        </Button>
      </div>

      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
      {(titleState.state === 'error' || descriptionState.state === 'error') && (
        <Notice
          tone="error"
          action={
            <Button
              size="small"
              onClick={() => {
                void title.flush()
                void description.flush()
              }}
            >
              Try again
            </Button>
          }
        >
          Couldn’t save this task: {titleState.error ?? descriptionState.error}
        </Notice>
      )}

      <div className={styles.cols}>
        <div className={styles.stack}>
          <section className={styles.box} aria-label="Details">
            <textarea
              className={styles.title}
              rows={1}
              aria-label="Title"
              placeholder="Untitled"
              value={titleText}
              onChange={(event) => {
                const text = event.target.value.replace(/[\r\n]/g, ' ')
                setTitleText(text)
                title.change(text)
              }}
              onBlur={() => void title.flush()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void title.flush()
                  event.currentTarget.blur()
                }
              }}
            />
            <TagsField
              tags={task.tags}
              suggestions={tagsIn(rows)}
              onChange={(tags) => update({ tags })}
            />
            <div className={styles.metaRow}>
              <Segmented
                label="Status"
                value={task.status}
                options={TASK_STATUSES.map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                  icon: <StatusIcon status={s} size={16} />
                }))}
                onChange={(status) => void setTaskStatus(task, status)}
              />
              <Segmented
                label="Priority"
                value={task.priority}
                options={PRIORITY_OPTIONS}
                onChange={(priority) => update({ priority })}
              />
            </div>
            <div className={styles.metaRow}>
              <div className={styles.field}>
                <span className={styles.label}>Due</span>
                <DueField value={task.due} today={today} onChange={(due) => update({ due })} />
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Repeats</span>
                <RecurrenceField
                  value={task.recurrence}
                  onChange={(recurrence) => update({ recurrence })}
                />
              </div>
              <div className={[styles.field, styles.grow].join(' ')}>
                <span className={styles.label}>List</span>
                <ListField
                  workspace={workspace}
                  list={task.list}
                  sublist={task.sublist}
                  rows={rows}
                  onChange={({ list, sublist }) => update({ list, sublist })}
                />
              </div>
            </div>
          </section>

          <Subtasks
            row={row}
            workspace={workspace}
            today={today}
            done={progress.done}
            total={progress.total}
            tracked={tracked}
          />

          <EditorCard
            text={bodyText}
            edited={Date.parse(task.updatedAt)}
            save={descriptionState.state}
            hasContent={bodyText.trim() !== ''}
          >
            <LiveEditor
              initial={startBody}
              placeholder="Add notes…"
              showPlaceholder={bodyText.trim() === ''}
              entitySelf={{ kind: 'task', workspace, id: task.uid }}
              onChange={(text) => {
                setBodyText(text)
                description.change(text)
              }}
              onBlur={() => void description.flush()}
            />
          </EditorCard>
        </div>

        <aside className={styles.stack} aria-label="Side">
          <TaskTimeCard
            task={task}
            workspace={workspace}
            time={time}
            own={own}
            isRunning={running.has(task.uid)}
            today={today}
            yearFor={yearFor}
            clientFor={clientFor}
            months={months(task.uid)}
            list={task.list}
            parts={row.kids.filter((k) => k.status !== 'done' && !sessionTasks.has(k.uid))}
            actions={!sessionTasks.has(task.uid)}
          />
          <MentionedIn
            kind="task"
            entityKey={task.uid}
            exclude={{ kind: 'task', workspace, id: task.uid }}
          />
        </aside>
      </div>
    </div>
  )
}

function Subtasks({
  row,
  workspace,
  today,
  done,
  total,
  tracked
}: {
  row: TaskRow
  workspace: TaskWorkspace
  today: string
  done: number
  total: number
  tracked: ReadonlyMap<string, number>
}): React.JSX.Element {
  return (
    <section className={styles.box} aria-label="Subtasks">
      <span className={styles.label}>
        Subtasks · {done} of {total} done
        {total > 0 && (
          <span className={styles.bar} aria-hidden>
            <i style={{ width: `${(done / total) * 100}%` }} />
          </span>
        )}
      </span>
      {/* The same rows as the Tasks table, so a subtask looks and behaves the same everywhere. */}
      <TasksTable
        flat
        rows={[{ ...row, nested: [] }]}
        workspace={workspace}
        today={today}
        label="Subtasks"
        tracked={tracked}
        running={new Set()}
      />
    </section>
  )
}
