import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { Dialog } from '@renderer/components/Dialog'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { Segmented } from '@renderer/components/Segmented'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import { MentionedIn } from '@renderer/entities/MentionedIn'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { registerFlushable } from '@renderer/lib/flush-registry'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import { EditorCard } from '@renderer/notes/EditorCard'
import { formatTaskTime } from '../shared/query'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskChanges,
  type TaskWorkspace
} from '../shared/types'
import { subtaskProgress, taskTime, type TaskRow } from '../shared/views'
import { DebouncedSaver } from './debounced-saver'
import { DueField } from './DueField'
import { ListField } from './ListField'
import { setTaskStatus, STATUS_LABELS } from './task-actions'
import { PRIORITY_LABELS } from './task-labels'
import { showTaskToast } from './task-toast'
import { StatusIcon } from './TaskIcons'
import { RecurrenceField } from './RecurrenceField'
import { TagsField } from './TagsField'
import { TaskTimeCard } from './TaskTimeCard'
import { taskRoute, tasksBase, todayIso, useTasksWorkspace } from './tasks-paths'
import { useTaskTime } from './useTaskTime'
import { useTasksList } from './useTasksList'
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
        <Link className={styles.back} to={tasksBase(workspace)}>
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
          Tasks
        </Link>
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
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const update = (changes: TaskChanges): void => {
    setError(null)
    window.api.tasks.update(task.uid, changes).catch((e: unknown) => setError(ipcErrorMessage(e)))
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
  const backTo = tasksBase(workspace)

  const remove = async (): Promise<void> => {
    setBusy(true)
    try {
      await Promise.all([title.flush(), description.flush()])
      const untouched =
        title.current === '' && description.current.trim() === '' && row.kids.length === 0
      if (untouched && (await window.api.tasks.discardIfEmpty(task.uid))) {
        void navigate(backTo, { replace: true })
        return
      }
      await window.api.tasks.delete(task.uid)
      void navigate(backTo, { replace: true })
      showTaskToast(`Deleted “${title.current || 'Untitled'}”.`, {
        label: 'Undo',
        run: () =>
          void window.api.tasks
            .restore(task.uid)
            .catch((e: unknown) => showTaskToast(`Couldn’t bring it back: ${ipcErrorMessage(e)}`))
      })
    } catch (e) {
      setError(ipcErrorMessage(e))
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const untouchedNow = titleText === '' && bodyText.trim() === '' && row.kids.length === 0

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Link className={styles.back} to={backTo}>
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
          Tasks
        </Link>
        <Button
          size="small"
          className={styles.delete}
          disabled={busy}
          onClick={() => (untouchedNow ? void remove() : setConfirmDelete(true))}
        >
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
            <input
              className={styles.title}
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
            <TagsField tags={task.tags} onChange={(tags) => update({ tags })} />
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
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
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
                  list={task.list}
                  sublist={task.sublist}
                  rows={rows}
                  onChange={({ list, sublist }) => update({ list, sublist })}
                />
              </div>
            </div>
          </section>

          <Subtasks
            task={task}
            kids={row.kids}
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
          />
          <MentionedIn
            kind="task"
            entityKey={task.uid}
            exclude={{ kind: 'task', workspace, id: task.uid }}
          />
        </aside>
      </div>

      {confirmDelete && (
        <Dialog
          title="Delete this task?"
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          actions={
            <>
              <Button
                size="small"
                autoFocus
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button size="small" variant="danger" disabled={busy} onClick={() => void remove()}>
                Delete task
              </Button>
            </>
          }
        >
          {row.kids.length === 0
            ? 'It goes to the trash; you can undo right after.'
            : `It and its ${row.kids.length} ${row.kids.length === 1 ? 'subtask' : 'subtasks'} go to the trash; you can undo right after.`}
        </Dialog>
      )}
    </div>
  )
}

function Subtasks({
  task,
  kids,
  workspace,
  today,
  done,
  total,
  tracked
}: {
  task: Task
  kids: readonly Task[]
  workspace: TaskWorkspace
  today: string
  done: number
  total: number
  tracked: ReadonlyMap<string, number>
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = async (): Promise<void> => {
    const title = text.trim()
    if (!title) return
    try {
      await window.api.tasks.create({ workspace, title, parentUid: task.uid })
      setText('')
      setError(null)
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }

  return (
    <section className={styles.box} aria-label="Subtasks">
      <div className={styles.subHead}>
        <span className={styles.label}>
          Subtasks · {done} of {total} done
          {total > 0 && (
            <span className={styles.bar} aria-hidden>
              <i style={{ width: `${(done / total) * 100}%` }} />
            </span>
          )}
        </span>
        <button type="button" className={styles.quiet} onClick={() => setAdding(true)}>
          <Plus size={14} strokeWidth={1.75} aria-hidden />
          Add subtask
        </button>
      </div>
      {kids.map((kid) => (
        <SubtaskRow
          key={kid.uid}
          kid={kid}
          today={today}
          minutes={kid.earlierMinutes + (tracked.get(kid.uid) ?? 0)}
          onError={setError}
        />
      ))}
      {adding && (
        <div className={styles.subAdd}>
          <span />
          <input
            autoFocus
            className={styles.subInput}
            aria-label={`New subtask of ${task.title}`}
            placeholder="Subtask title"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void add()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                setText('')
                setAdding(false)
              }
            }}
            onBlur={() => {
              if (text.trim() === '') setAdding(false)
            }}
          />
          <span />
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  )
}

/** One subtask, all of it editable in place: status, title, due date, tags and notes. */
function SubtaskRow({
  kid,
  today,
  minutes,
  onError
}: {
  kid: Task
  today: string
  minutes: number
  onError: (message: string | null) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(kid.title)
  const [notes, setNotes] = useState(kid.description)

  const update = (changes: TaskChanges): void => {
    onError(null)
    window.api.tasks.update(kid.uid, changes).catch((e: unknown) => onError(ipcErrorMessage(e)))
  }
  const saveTitle = (): void => {
    const text = title.trim()
    if (text === kid.title) return
    if (text === '') setTitle(kid.title)
    else update({ title: text })
  }
  const remove = (): void => {
    window.api.tasks
      .delete(kid.uid)
      .then(() =>
        showTaskToast(`Deleted “${kid.title || 'Untitled'}”.`, {
          label: 'Undo',
          run: () =>
            void window.api.tasks
              .restore(kid.uid)
              .catch((e: unknown) => showTaskToast(`Couldn’t bring it back: ${ipcErrorMessage(e)}`))
        })
      )
      .catch((e: unknown) => onError(ipcErrorMessage(e)))
  }

  return (
    <div className={styles.subItem}>
      <div className={styles.subRow}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={`Status: ${STATUS_LABELS[kid.status]}`}
          title={`${STATUS_LABELS[kid.status]}`}
          onClick={() =>
            void setTaskStatus(
              kid,
              kid.status === 'done' ? 'todo' : kid.status === 'todo' ? 'doing' : 'done'
            )
          }
        >
          <StatusIcon status={kid.status} size={20} />
        </button>
        <input
          className={styles.subTitleInput}
          aria-label="Subtask title"
          placeholder="Untitled"
          value={title}
          onChange={(event) => setTitle(event.target.value.replace(/[\r\n]/g, ' '))}
          onBlur={saveTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
        />
        <DueField
          label="Subtask due"
          value={kid.due}
          today={today}
          onChange={(due) => update({ due })}
        />
        <span className={styles.subTime}>{formatTaskTime(minutes)}</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={open ? 'Hide details' : 'Show details'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronUp size={16} strokeWidth={1.75} aria-hidden />
          ) : (
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Delete subtask"
          onClick={remove}
        >
          <Trash2 size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {open && (
        <div className={styles.subDetails}>
          <TagsField tags={kid.tags} onChange={(tags) => update({ tags })} />
          <textarea
            className={styles.subNotes}
            aria-label="Subtask notes"
            placeholder="Add notes…"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => {
              if (notes !== kid.description) update({ description: notes })
            }}
          />
        </div>
      )}
    </div>
  )
}
