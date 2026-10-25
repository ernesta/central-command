import { ChevronDown, ChevronRight, Plus, Repeat, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { DatePicker } from '@renderer/components/DatePicker'
import { showToast } from '@renderer/components/toast-store'
import { pushUndoWithToast } from '@renderer/components/undo-store'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { Tooltip } from '@renderer/components/Tooltip'
import { describeRecurrence } from '../shared/recurrence'
import { fieldLocked, sessionLock } from '../shared/session-lock'
import { StudyIcon } from './TaskName'
import { studyName } from '../shared/study-label'
import { LateChip } from './LateChip'
import { daysLate } from '../shared/late'
import { dueTone, formatDue, formatTaskTime, tagsIn, type SortKey } from '../shared/query'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskChanges,
  type TaskPriority,
  type TaskWorkspace
} from '../shared/types'
import {
  effectiveDue,
  subtaskProgress,
  taskTime,
  type SectionRow,
  type TaskRow
} from '../shared/views'
import {
  NEXT_STATUS,
  PREVIOUS_STATUS,
  STATUS_LABELS,
  nextStatus,
  setTaskStatus,
  updateTaskUndoable,
  deletedMessage
} from './task-actions'
import { DeleteTimeDialog } from '@renderer/components/DeleteTimeDialog'
import { PriorityBadge, StatusIcon } from './TaskIcons'
import { PRIORITY_LABELS } from './task-labels'
import { ListField } from './ListField'
import { TagsField } from './TagsField'
import { useTasksList } from './useTasksList'
import { TaskMenu, type MenuGroup } from './TaskMenu'
import { taskRoute } from './tasks-paths'
import styles from './TasksTable.module.css'

type Item =
  | { type: 'task'; key: string; task: Task; kids: Task[] }
  | { type: 'kid'; key: string; task: Task; last: boolean; flat?: boolean }
  | { type: 'add'; key: string; parent: Task }

/** The rows that are on screen: each task, then (open) all its subtasks and a line to add one, or (closed) only the subtasks that put it here. */
function buildFlatItems(row: SectionRow | undefined): Item[] {
  if (!row) return []
  return [
    ...row.kids.map((kid): Item => ({
      type: 'kid',
      key: kid.uid,
      task: kid,
      last: false,
      flat: true
    })),
    { type: 'add', key: `add-${row.task.uid}`, parent: row.task }
  ]
}

function buildItems(rows: readonly SectionRow[], open: ReadonlySet<string>): Item[] {
  const items: Item[] = []
  for (const row of rows) {
    items.push({ type: 'task', key: row.task.uid, task: row.task, kids: row.kids })
    if (open.has(row.task.uid)) {
      for (const kid of row.kids) items.push({ type: 'kid', key: kid.uid, task: kid, last: false })
      items.push({ type: 'add', key: `add-${row.task.uid}`, parent: row.task })
    } else {
      row.nested.forEach((kid, i) =>
        items.push({
          type: 'kid',
          key: `nested-${kid.uid}`,
          task: kid,
          last: i === row.nested.length - 1
        })
      )
    }
  }
  return items
}

interface MenuState {
  task: Task
  x: number
  y: number
  /** `priority` from the badge, `status` or `priority` from a right-click on that cell, `row` from a right-click elsewhere or the menu key. */
  kind: 'priority' | 'status' | 'row'
}

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: 'Status', key: 'status' },
  { label: 'Task', key: 'title' },
  { label: 'List', key: 'list' },
  { label: 'Priority', key: 'priority' },
  { label: 'Time', key: 'time' },
  { label: 'Due', key: 'due' }
]

/**
 * The one table every list of tasks uses: Status (an icon you can click), Task (title, tags, the repeat icon, the subtask
 * pill), List, Priority (P1 to P3), Time and Due. Only top-level tasks are rows; their subtasks open under them. Like the
 * other tables it is one tab stop: arrow keys move, Enter opens, Space moves the status on, Right and Left open and close
 * the subtasks; right-click (or the menu key) gives status, priority and Add subtask.
 */
export function TasksTable({
  rows,
  workspace,
  today,
  label,
  empty,
  tracked,
  running,
  sort,
  flat = false
}: {
  rows: readonly SectionRow[]
  workspace: TaskWorkspace
  today: string
  label: string
  empty?: string
  /** Minutes of Hours sessions by task uid. */
  tracked: ReadonlyMap<string, number>
  /** Tasks with a timer running (marked with the accent stripe). */
  running: ReadonlySet<string>
  /** Column sorting, only on the All tasks page. */
  sort?: { key: SortKey; dir: 'asc' | 'desc'; onSort: (key: SortKey) => void }
  /** One task's subtasks on its own page (`rows` is that task alone): no header, no parent row, no List or Priority, always open. */
  flat?: boolean
}): React.JSX.Element {
  const navigate = useNavigate()
  const { rows: allRows } = useTasksList(workspace)
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const items = useMemo(
    () => (flat ? buildFlatItems(rows[0]) : buildItems(rows, open)),
    [rows, open, flat]
  )
  const span = flat ? 3 : 6

  const toggle = (uid: string, to?: boolean): void =>
    setOpen((current) => {
      const next = new Set(current)
      const want = to ?? !next.has(uid)
      if (want) next.add(uid)
      else next.delete(uid)
      return next
    })
  const startAdding = (parentUid: string): void => {
    toggle(parentUid, true)
    setAdding(parentUid)
  }
  const focusRow = (uid: string): void => {
    tableRef.current?.querySelector<HTMLElement>(`tr[data-uid="${uid}"]`)?.focus()
  }

  const { tableProps, rowProps } = useRowNavigation(items.length, (index) => {
    const item = items[index]
    if (item.type === 'add') startAdding(item.parent.uid)
    else if (flat) return
    else void navigate(taskRoute(workspace, item.task.uid))
  })

  const menuGroups = (state: MenuState): MenuGroup[] => {
    const { task } = state
    const lock = sessionLock(
      task,
      task.parentUid ? [] : (allRows?.find((r) => r.task.uid === task.uid)?.kids ?? [])
    )
    const priority: MenuGroup = {
      label: 'Priority',
      items: TASK_PRIORITIES.map((p) => ({
        key: p,
        label: PRIORITY_LABELS[p],
        icon: <PriorityBadge priority={p} />,
        checked: task.priority === p,
        onSelect: () => void setPriority(task, p)
      }))
    }
    if (state.kind === 'priority') return [priority]
    // A session task's status is its note's and the clock's.
    if (fieldLocked(lock, 'status') && state.kind === 'status') return []
    const status: MenuGroup = {
      label: 'Status',
      items: TASK_STATUSES.map((s) => ({
        key: s,
        label: STATUS_LABELS[s],
        icon: <StatusIcon status={s} size={18} />,
        checked: task.status === s,
        onSelect: () => void setTaskStatus(task, s)
      }))
    }
    const statusGroups = fieldLocked(lock, 'status') ? [] : [status]
    if (state.kind === 'status' || task.parentUid)
      return fieldLocked(lock, 'status') ? [priority] : [status]
    return [
      ...statusGroups,
      priority,
      {
        items: [
          {
            key: 'add-subtask',
            label: 'Add subtask',
            icon: <Plus size={16} strokeWidth={1.75} aria-hidden />,
            onSelect: () => startAdding(task.uid)
          }
        ]
      }
    ]
  }

  const onRowKeyDown = (event: React.KeyboardEvent, index: number): void => {
    // Typing in the add-a-subtask field is that field's own business.
    if (event.target instanceof HTMLInputElement) return
    const item = items[index]
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === ' ' && item.type !== 'add') {
      event.preventDefault()
      const kids = item.type === 'task' ? item.kids : []
      if (fieldLocked(sessionLock(item.task, kids), 'status')) return
      void setTaskStatus(item.task, nextStatus(item.task.status, event.shiftKey))
      return
    }
    if (event.key === 'ArrowRight' && item.type === 'task' && item.kids.length > 0) {
      event.preventDefault()
      toggle(item.task.uid, true)
      return
    }
    if (event.key === 'ArrowLeft') {
      const uid =
        item.type === 'task'
          ? item.task.uid
          : item.type === 'kid'
            ? item.task.parentUid
            : item.parent.uid
      if (uid && open.has(uid)) {
        event.preventDefault()
        toggle(uid, false)
        setAdding(null)
        if (item.type !== 'task') focusRow(uid)
      }
      return
    }
    rowProps(index).onKeyDown(event)
  }

  const sortHeader = (column: { label: string; key: SortKey }): React.ReactNode => {
    if (!sort) return column.label
    const active = sort.key === column.key
    return (
      <button
        type="button"
        className={styles.sort}
        onClick={() => sort.onSort(column.key)}
        aria-label={`Sort by ${column.label.toLowerCase()}`}
      >
        {column.label}
        {active && (
          <ChevronDown
            size={12}
            strokeWidth={2}
            aria-hidden
            className={sort.dir === 'asc' ? styles.asc : undefined}
          />
        )}
      </button>
    )
  }

  return (
    <div className={flat ? styles.wrapFlat : styles.wrap}>
      <table
        ref={tableRef}
        className={[styles.table, flat && styles.tableFlat].filter(Boolean).join(' ')}
        aria-label={label}
        {...tableProps}
      >
        <colgroup>
          <col className={styles.colStatus} />
          <col />
          {!flat && <col className={styles.colList} />}
          {!flat && <col className={styles.colPriority} />}
          <col className={styles.colTime} />
          <col className={styles.colDue} />
        </colgroup>
        {!flat && (
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  className={styles.th}
                  scope="col"
                  aria-sort={
                    sort && sort.key === c.key
                      ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {sortHeader(c)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {items.length === 0 && (
            <tr className={styles.emptyRow}>
              <td />
              <td colSpan={span - 1}>{empty ?? 'Nothing here.'}</td>
            </tr>
          )}
          {items.map((item, index) =>
            item.type === 'add' ? (
              <AddSubtaskRow
                key={item.key}
                parent={item.parent}
                workspace={workspace}
                span={span}
                adding={adding === item.parent.uid}
                rowProps={rowProps(index)}
                onKeyDown={(e) => onRowKeyDown(e, index)}
                onStart={() => startAdding(item.parent.uid)}
                onStop={() => {
                  setAdding(null)
                  focusRow(item.parent.uid)
                }}
              />
            ) : (
              <TaskRowView
                key={item.key}
                item={item}
                workspace={workspace}
                allRows={allRows ?? []}
                today={today}
                tracked={tracked}
                isRunning={running.has(item.task.uid)}
                flat={flat}
                isOpen={open.has(item.task.uid)}
                rowProps={rowProps(index)}
                onKeyDown={(e) => onRowKeyDown(e, index)}
                onOpen={() => {
                  if (!flat) void navigate(taskRoute(workspace, item.task.uid))
                }}
                onToggle={() => toggle(item.task.uid)}
                onAddSubtask={() => startAdding(item.task.uid)}
                onPriorityMenu={(x, y) =>
                  setMenu((open) =>
                    open?.kind === 'priority' && open.task.uid === item.task.uid
                      ? null
                      : { task: item.task, x, y, kind: 'priority' }
                  )
                }
                onContextMenu={(x, y, kind) => setMenu({ task: item.task, x, y, kind })}
              />
            )
          )}
        </tbody>
      </table>
      {menu && (
        <TaskMenu
          x={menu.x}
          y={menu.y}
          label={menu.kind === 'priority' ? 'Priority' : menu.kind === 'status' ? 'Status' : 'Task'}
          groups={menuGroups(menu)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

async function updateTask(
  task: Task,
  changes: TaskChanges,
  what: string,
  label: string
): Promise<void> {
  try {
    await updateTaskUndoable(task, changes, label)
  } catch (error) {
    showToast(`Couldn’t ${what}: ${ipcErrorMessage(error)}`)
  }
}

const setDue = (task: Task, due: string | null): Promise<void> =>
  updateTask(task, { due }, 'change the due date', 'due date change')

/** To the trash, with an Undo in the toast (a task's subtasks go with it and come back with it). */
async function removeTask(task: Task): Promise<void> {
  try {
    const minutes = await window.api.tasks.delete(task.uid)
    pushUndoWithToast(deletedMessage(task.title, minutes), {
      label: `deletion of “${task.title || 'Untitled'}”`,
      message: `Brought back “${task.title || 'Untitled'}”.`,
      undo: async () => {
        await window.api.tasks.restore(task.uid)
      }
    })
  } catch (error) {
    showToast(`Couldn’t delete it: ${ipcErrorMessage(error)}`)
  }
}

/** Spread on a wrapper so clicks and keys inside a control never reach the row (which opens the task or moves the selection). */
const stopRow = {
  onClick: (event: React.MouseEvent) => event.stopPropagation(),
  onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation()
}

/** The title: a click edits it in place (Return or leaving saves, Escape undoes); an empty title is not saved. */
function TitleCell({
  task,
  locked,
  study
}: {
  task: Task
  locked: boolean
  /** A self-study task's training name: shown with a cap in place of its stored title. */
  study: string | null
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(task.title)
  const classes = [styles.title, task.status === 'done' && styles.titleDone].filter(Boolean)
  if (locked) {
    return (
      <span className={classes.filter(Boolean).join(' ')}>
        {study !== null && <StudyIcon />}
        {study ?? (task.title || 'Untitled')}
      </span>
    )
  }
  if (!editing) {
    return (
      <span
        className={[...classes, styles.editable].join(' ')}
        onClick={(event) => {
          event.stopPropagation()
          setText(task.title)
          setEditing(true)
        }}
      >
        {task.title || 'Untitled'}
      </span>
    )
  }
  const finish = (save: boolean): void => {
    setEditing(false)
    const next = text.trim()
    if (save && next && next !== task.title)
      void updateTask(task, { title: next }, 'rename it', 'rename')
  }
  return (
    <input
      autoFocus
      className={styles.titleInput}
      aria-label="Task title"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => finish(true)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') finish(true)
        else if (event.key === 'Escape') finish(false)
      }}
    />
  )
}

async function setPriority(task: Task, priority: TaskPriority): Promise<void> {
  try {
    await updateTaskUndoable(task, { priority }, 'priority change')
  } catch (error) {
    showToast(`Couldn’t change the priority: ${ipcErrorMessage(error)}`)
  }
}

type RowProps = ReturnType<ReturnType<typeof useRowNavigation>['rowProps']>

function TaskRowView({
  item,
  workspace,
  allRows,
  today,
  tracked,
  isRunning,
  isOpen,
  flat,
  rowProps,
  onKeyDown,
  onOpen,
  onToggle,
  onAddSubtask,
  onPriorityMenu,
  onContextMenu
}: {
  item: Extract<Item, { type: 'task' | 'kid' }>
  workspace: TaskWorkspace
  allRows: readonly TaskRow[]
  today: string
  tracked: ReadonlyMap<string, number>
  isRunning: boolean
  isOpen: boolean
  flat: boolean
  rowProps: RowProps
  onKeyDown: (event: React.KeyboardEvent) => void
  onOpen: () => void
  onToggle: () => void
  onAddSubtask: () => void
  onPriorityMenu: (x: number, y: number) => void
  onContextMenu: (x: number, y: number, kind: MenuState['kind']) => void
}): React.JSX.Element {
  const { task } = item
  const kids = item.type === 'task' ? item.kids : []
  const isKid = item.type === 'kid'
  const due = isKid ? task.due : effectiveDue(task, kids)
  const minutes = taskTime({ task, kids }, tracked).total
  // A task the app made for a meeting or training is the note's: shown, not edited (title, list, date, status, delete).
  const lock = sessionLock(task, kids)
  const statusLocked = fieldLocked(lock, 'status')
  const textLocked = lock !== null
  // A task with saved time asks before it goes: the time leaves Hours with it.
  const [ask, setAsk] = useState<number | null>(null)
  const startRemove = async (): Promise<void> => {
    try {
      const saved = await window.api.tasks.timeOn(task.uid)
      if (saved > 0) setAsk(saved)
      else await removeTask(task)
    } catch (error) {
      showToast(`Couldn’t delete it: ${ipcErrorMessage(error)}`)
    }
  }
  const classes = [
    styles.row,
    isKid && !flat && styles.kid,
    isKid && !flat && item.last && styles.end,
    isRunning && styles.running
  ]
  return (
    <tr
      className={classes.filter(Boolean).join(' ')}
      data-uid={task.uid}
      {...rowProps}
      onKeyDown={onKeyDown}
      onClick={onOpen}
      onContextMenu={(event) => {
        event.preventDefault()
        // From the keyboard (the menu key) there is no pointer: open it at the row.
        const rect = event.currentTarget.getBoundingClientRect()
        const fromKeyboard = event.clientX === 0 && event.clientY === 0
        // Right-click on the status or priority cell offers only that part.
        const cell = fromKeyboard
          ? null
          : (event.target as HTMLElement).closest<HTMLElement>('td[data-cell]')?.dataset.cell
        onContextMenu(
          fromKeyboard ? rect.left + 24 : event.clientX,
          fromKeyboard ? rect.bottom : event.clientY,
          cell === 'status' || (cell === 'priority' && !isKid) ? cell : 'row'
        )
      }}
    >
      <td data-cell="status">
        <Tooltip
          text={
            statusLocked
              ? `${STATUS_LABELS[task.status]} · set by its meeting or training`
              : `${STATUS_LABELS[task.status]} · click for ${STATUS_LABELS[NEXT_STATUS[task.status]]}, Shift-click for ${STATUS_LABELS[PREVIOUS_STATUS[task.status]]}`
          }
        >
          <button
            type="button"
            tabIndex={-1}
            className={styles.iconButton}
            aria-label={`Status: ${STATUS_LABELS[task.status]}`}
            aria-disabled={statusLocked || undefined}
            onClick={(event) => {
              event.stopPropagation()
              if (!statusLocked) void setTaskStatus(task, nextStatus(task.status, event.shiftKey))
            }}
          >
            <StatusIcon status={task.status} size={isKid && !flat ? 18 : 22} />
          </button>
        </Tooltip>
      </td>
      <td>
        <div className={styles.titleLine}>
          {/* A subtask's parent is always in view here, so its name stands alone ("Introduction"); a self-study task shows its training's name with a cap. */}
          <TitleCell
            locked={textLocked}
            task={task}
            study={studyName(task, allRows.find((r) => r.task.uid === task.parentUid)?.task)}
          />
          {task.recurrence && (
            <Tooltip text={describeRecurrence(task.recurrence)}>
              <span className={styles.repeat}>
                <Repeat
                  size={14}
                  strokeWidth={1.75}
                  aria-label={describeRecurrence(task.recurrence)}
                />
              </span>
            </Tooltip>
          )}
          <span className={styles.tags} {...stopRow}>
            <TagsField
              inline
              tags={task.tags}
              suggestions={tagsIn(allRows)}
              onChange={(tags) => void updateTask(task, { tags }, 'change the tags', 'tag change')}
            />
          </span>
          {!isKid && (
            <SubtaskPill kids={kids} open={isOpen} onToggle={onToggle} onAdd={onAddSubtask} />
          )}
        </div>
      </td>
      {!flat && (
        <td className={[styles.nowrap, styles.list].join(' ')}>
          {!isKid && textLocked && <span className={styles.plainValue}>{task.list}</span>}
          {!isKid && !textLocked && (
            <span {...stopRow}>
              <ListField
                plain
                workspace={workspace}
                list={task.list}
                sublist={task.sublist}
                rows={allRows}
                onChange={({ list, sublist }) =>
                  void updateTask(task, { list, sublist }, 'change the list', 'list change')
                }
              />
            </span>
          )}
        </td>
      )}
      {!flat && (
        <td data-cell="priority">
          {!isKid && (
            <Tooltip text={`Priority: ${PRIORITY_LABELS[task.priority]}`}>
              <button
                type="button"
                tabIndex={-1}
                data-menu-trigger
                className={styles.iconButton}
                aria-label={`Priority: ${PRIORITY_LABELS[task.priority]}`}
                onClick={(event) => {
                  event.stopPropagation()
                  const rect = event.currentTarget.getBoundingClientRect()
                  onPriorityMenu(rect.left, rect.bottom + 4)
                }}
              >
                <PriorityBadge priority={task.priority} />
              </button>
            </Tooltip>
          )}
        </td>
      )}
      <td className={styles.nowrap}>{formatTaskTime(minutes)}</td>
      <td className={styles.nowrap} onClick={(event) => event.stopPropagation()}>
        <span className={styles.dueCell}>
          <span
            className={[
              styles.dueDate,
              due
                ? styles[
                    `due_${task.status === 'done' || dueTone(due, today) === 'overdue' ? 'normal' : dueTone(due, today)}`
                  ]
                : undefined
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {textLocked ? (
              <span className={styles.plainValue}>
                {task.due ? formatDue(task.due, today) : 'No date'}
              </span>
            ) : (
              <DatePicker
                label="Due"
                plain
                value={task.due}
                // A parent with subtasks and no date of its own shows the earliest of theirs, as a placeholder.
                placeholder={due ? formatDue(due, today) : 'Add date'}
                today={today}
                onChange={(next) => void setDue(task, next)}
              />
            )}
          </span>
          <span className={styles.lateSlot}>
            {due && task.status !== 'done' && <LateChip days={daysLate(due, today)} />}
          </span>
          {!textLocked && (
            <Tooltip text="Delete">
              <button
                type="button"
                tabIndex={-1}
                className={[styles.iconButton, styles.remove].join(' ')}
                aria-label={`Delete ${task.title || 'Untitled'}`}
                onClick={() => void startRemove()}
              >
                <Trash2 size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </Tooltip>
          )}
          {ask !== null && (
            <span {...stopRow}>
              <DeleteTimeDialog
                title={task.title}
                minutes={ask}
                onCancel={() => setAsk(null)}
                onConfirm={() => {
                  setAsk(null)
                  void removeTask(task)
                }}
              />
            </span>
          )}
        </span>
      </td>
    </tr>
  )
}

/** The one control for subtasks: the count with a fill showing progress, opening them; "+ Subtask" on hover when there are none. */
function SubtaskPill({
  kids,
  open,
  onToggle,
  onAdd
}: {
  kids: readonly Task[]
  open: boolean
  onToggle: () => void
  onAdd: () => void
}): React.JSX.Element {
  if (kids.length === 0) {
    return (
      <button
        type="button"
        tabIndex={-1}
        className={[styles.pill, styles.ghost].join(' ')}
        aria-label="Add subtask"
        onClick={(event) => {
          event.stopPropagation()
          onAdd()
        }}
      >
        + Subtask
      </button>
    )
  }
  const { done, total } = subtaskProgress(kids)
  return (
    <Tooltip text={`${done} of ${total} subtasks done`}>
      <button
        type="button"
        tabIndex={-1}
        className={[styles.pill, open && styles.pillOpen].filter(Boolean).join(' ')}
        aria-expanded={open}
        aria-label={`${done} of ${total} subtasks done. ${open ? 'Hide' : 'Show'} subtasks`}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        <span className={styles.fill} style={{ width: `${(done / total) * 100}%` }} />
        <span className={styles.pillText}>
          {done}/{total}
        </span>
        {open ? (
          <ChevronDown size={12} strokeWidth={1.75} className={styles.pillIcon} aria-hidden />
        ) : (
          <ChevronRight size={12} strokeWidth={1.75} className={styles.pillIcon} aria-hidden />
        )}
      </button>
    </Tooltip>
  )
}

function AddSubtaskRow({
  parent,
  workspace,
  span,
  adding,
  rowProps,
  onKeyDown,
  onStart,
  onStop
}: {
  parent: Task
  workspace: TaskWorkspace
  span: number
  adding: boolean
  rowProps: RowProps
  onKeyDown: (event: React.KeyboardEvent) => void
  onStart: () => void
  onStop: () => void
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    const text = title.trim()
    if (text === '') return
    try {
      await window.api.tasks.create({ workspace, title: text, parentUid: parent.uid })
      setTitle('')
      setError(null)
    } catch (e) {
      setError(ipcErrorMessage(e))
    }
  }

  return (
    <tr
      className={[styles.row, span === 6 && styles.kid, span === 6 && styles.end, styles.addRow]
        .filter(Boolean)
        .join(' ')}
      {...rowProps}
      onKeyDown={onKeyDown}
      onClick={onStart}
    >
      <td />
      <td colSpan={span - 1}>
        {adding ? (
          <span className={styles.addInput}>
            <input
              autoFocus
              className={styles.addField}
              placeholder="Subtask title"
              aria-label={`New subtask of ${parent.title}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submit()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  onStop()
                }
              }}
              onBlur={() => {
                if (title.trim() === '') onStop()
              }}
            />
            <kbd className={styles.kbd}>Return</kbd>
            {error && (
              <span role="alert" className={styles.addError}>
                {error}
              </span>
            )}
          </span>
        ) : (
          <span>+ Add a subtask</span>
        )}
      </td>
    </tr>
  )
}
