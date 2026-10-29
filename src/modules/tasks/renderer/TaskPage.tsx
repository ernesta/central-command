import { useToday } from '@renderer/state/use-today'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { GraduationCap } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { Notice } from '@renderer/components/Notice'
import { Segmented } from '@renderer/components/Segmented'
import { pushUndoWithToast } from '@renderer/components/undo-store'
import { LiveEditor } from '@renderer/editor/LiveEditor'
import { MentionedIn } from '@renderer/entities/MentionedIn'
import { seriesTarget, sourceTarget } from '@renderer/entities/source-routes'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { registerFlushable } from '@renderer/lib/flush-registry'
import { IconButton } from '@renderer/components/IconButton'
import { useDocumentTitle } from '@renderer/lib/use-document-title'
import { EditorCard } from '@renderer/notes/EditorCard'
import { describeRecurrence } from '../shared/recurrence'
import { fieldLocked, lockOf, type SessionSource } from '../shared/session-lock'
import { LateChip } from './LateChip'
import { daysLate } from '../shared/late'
import { formatDue, listLabel, tagsIn } from '../shared/query'
import { TASK_STATUSES, type Task, type TaskChanges, type TaskWorkspace } from '../shared/types'
import { subtaskProgress, taskTime, type TaskRow } from '../shared/views'
import { DebouncedSaver } from './debounced-saver'
import { DueField } from './DueField'
import { ListField } from './ListField'
import { DeleteTimeDialog } from '@renderer/components/DeleteTimeDialog'
import { deletedMessage, setTaskStatus, STATUS_LABELS, updateTaskUndoable } from './task-actions'
import { PRIORITY_OPTIONS } from './task-labels'
import { StatusIcon } from './TaskIcons'
import { RecurrenceField } from './RecurrenceField'
import { TagsField } from './TagsField'
import { TasksTable } from './TasksTable'
import { TaskTimeCard } from './TaskTimeCard'
import { taskRoute, useTasksWorkspace } from './tasks-paths'
import { useTaskTime } from './useTaskTime'
import { useTasksList } from './useTasksList'
import { useSessionTaskUids } from './useSessionTaskUids'
import styles from './TaskPage.module.css'

/** One task's page: its title, status, priority, due date and list, its subtasks, its description, and its time. */
export function TaskPage(): React.JSX.Element {
  const workspace = useTasksWorkspace()
  const { uid = '' } = useParams()
  const { tasks, rows, series } = useTasksList(workspace)
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
      series={series}
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

// A task made empty by `new:task` is removed when the page is left with nothing written in it. React StrictMode runs an effect's
// cleanup and setup back to back, so the removal waits a tick and a setup in between cancels it.
const pendingDiscard = new Map<string, ReturnType<typeof setTimeout>>()

function TaskView({
  task,
  row,
  rows,
  series,
  workspace
}: {
  task: Task
  row: TaskRow
  rows: readonly TaskRow[]
  series: ReadonlySet<string>
  workspace: TaskWorkspace
}): React.JSX.Element {
  const navigate = useNavigate()
  const isNew = (useLocation().state as { isNew?: boolean } | null)?.isNew === true
  const today = useToday()
  const { tracked, running, yearFor, clientFor, months, earlier } = useTaskTime(workspace)
  const sessionTasks = useSessionTaskUids(workspace)
  // A self-study task, or a series task over session tasks, is the notes' to keep (title, list, date, status, repeat, delete).
  const lock = lockOf(task, row.kids, series)
  const statusLocked = fieldLocked(lock, 'status')
  const source = useSessionSource(task.uid, lock !== null)
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

  useEffect(() => {
    if (!isNew) return
    clearTimeout(pendingDiscard.get(task.uid))
    pendingDiscard.delete(task.uid)
    return () => {
      pendingDiscard.set(
        task.uid,
        setTimeout(() => {
          pendingDiscard.delete(task.uid)
          // The savers flush as the page unmounts; the store only removes a task nothing was written in.
          void Promise.all([title.flush(), description.flush()]).then(() =>
            window.api.tasks.discardIfEmpty(task.uid)
          )
        }, 50)
      )
    }
  }, [isNew, task.uid, title, description])

  const time = taskTime(row, tracked)
  const progress = subtaskProgress(row.kids)
  // Leaving after a delete goes where the visitor came from, as Back does.
  const leave = (): void => void navigate(-1)

  const [ask, setAsk] = useState<number | null>(null)
  const remove = async (confirmed = false): Promise<void> => {
    setBusy(true)
    try {
      await Promise.all([title.flush(), description.flush()])
      const untouched =
        title.current === '' && description.current.trim() === '' && row.kids.length === 0
      if (untouched && (await window.api.tasks.discardIfEmpty(task.uid))) {
        leave()
        return
      }
      // A task with saved time asks first: the time leaves Hours with it.
      if (!confirmed) {
        const saved = await window.api.tasks.timeOn(task.uid)
        if (saved > 0) {
          setAsk(saved)
          setBusy(false)
          return
        }
      }
      const minutes = await window.api.tasks.delete(task.uid)
      leave()
      pushUndoWithToast(deletedMessage(title.current, minutes), {
        label: `deletion of “${title.current || 'Untitled'}”`,
        message: `Brought back “${title.current || 'Untitled'}”.`,
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
        {lock === null && (
          <Button
            size="small"
            variant="danger-outline"
            disabled={busy}
            onClick={() => void remove()}
          >
            Delete task
          </Button>
        )}
        {ask !== null && (
          <DeleteTimeDialog
            title={title.current}
            minutes={ask}
            busy={busy}
            onCancel={() => setAsk(null)}
            onConfirm={() => void remove(true)}
          />
        )}
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
            {lock ? (
              <h1 className={styles.lockedTitle}>{titleText}</h1>
            ) : (
              <textarea
                className={styles.title}
                rows={1}
                aria-label="Title"
                placeholder="Untitled"
                autoFocus={isNew}
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
            )}
            <div className={styles.metaRow}>
              {statusLocked ? (
                <div className={styles.field}>
                  <span className={styles.label}>Status</span>
                  <span className={styles.lockedValue}>
                    <StatusIcon status={task.status} size={16} />
                    {STATUS_LABELS[task.status]}
                  </span>
                </div>
              ) : (
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
              )}
              <Segmented
                label="Priority"
                value={task.priority}
                options={PRIORITY_OPTIONS}
                onChange={(priority) => update({ priority })}
              />
              <div className={styles.field}>
                <span className={styles.label}>Tags</span>
                <TagsField
                  tags={task.tags}
                  suggestions={tagsIn(rows)}
                  onChange={(tags) => update({ tags })}
                />
              </div>
            </div>
            <div className={styles.metaRow}>
              <div className={styles.field}>
                <span className={styles.label}>Due</span>
                <span className={styles.dueValue}>
                  {lock ? (
                    <span className={styles.lockedValue}>
                      {task.due ? formatDue(task.due, today) : 'No date'}
                    </span>
                  ) : (
                    <DueField value={task.due} today={today} onChange={(due) => update({ due })} />
                  )}
                  {task.status !== 'done' && <LateChip days={daysLate(task.due, today)} />}
                </span>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Repeats</span>
                {lock ? (
                  <span className={styles.lockedValue}>
                    {task.recurrence ? describeRecurrence(task.recurrence) : 'Does not repeat'}
                  </span>
                ) : (
                  <RecurrenceField
                    value={task.recurrence}
                    onChange={(recurrence) => update({ recurrence })}
                  />
                )}
              </div>
              <div className={[styles.field, lock ? '' : styles.grow].join(' ')}>
                <span className={styles.label}>List</span>
                {lock ? (
                  <span className={styles.lockedValue}>{listLabel(task.list, task.sublist)}</span>
                ) : (
                  <ListField
                    workspace={workspace}
                    list={task.list}
                    sublist={task.sublist}
                    rows={rows}
                    onChange={({ list, sublist }) => update({ list, sublist })}
                  />
                )}
              </div>
              {lock && source && <MadeByField lock={lock} source={source} />}
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
            isRunning={running.has(task.uid)}
            today={today}
            yearFor={yearFor}
            clientFor={clientFor}
            months={months([task.uid, ...row.kids.map((k) => k.uid)])}
            earlier={earlier([task, ...row.kids])}
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

/** The training whose note made a self-study task, or a series task over such tasks (null until it is read, or for any other task). */
function useSessionSource(uid: string, wanted: boolean): SessionSource | null {
  const [source, setSource] = useState<SessionSource | null>(null)
  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    void window.api.tasks.sessionSource(uid).then((found) => {
      if (!cancelled) setSource(found)
    })
    return () => {
      cancelled = true
    }
  }, [uid, wanted])
  return wanted ? source : null
}

/** A locked task's link to what made it: the series or training, as a field like the others, its name plain and an icon button to open it. */
function MadeByField({
  lock,
  source
}: {
  lock: 'session' | 'series'
  source: SessionSource
}): React.JSX.Element {
  const navigate = useNavigate()
  const { route } = sourceTarget({ kind: 'training', workspace: source.workspace, id: source.id })
  // A series task opens the series' own page when there is one, else the training under it.
  const series = lock === 'series'
  const to =
    series && source.series ? seriesTarget(source.kind, source.workspace, source.series) : route
  const name = series ? source.series || source.title : source.title
  const noun = series ? 'series' : 'training'
  return (
    <div className={styles.field}>
      <span className={styles.label}>{series ? 'Series' : 'Training'}</span>
      <span className={styles.lockedValue}>
        {name}
        <IconButton
          label={`Open ${noun}`}
          className={styles.openButton}
          onClick={() => void navigate(to)}
        >
          <GraduationCap size={16} strokeWidth={1.75} aria-hidden />
        </IconButton>
      </span>
    </div>
  )
}
