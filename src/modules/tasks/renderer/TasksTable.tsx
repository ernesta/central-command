import { ChevronDown, ChevronRight, Plus, Repeat } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { showToast } from '@renderer/components/toast-store'
import { useRowNavigation } from '@renderer/components/useRowNavigation'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { describeRecurrence } from '../shared/recurrence'
import { dueTone, formatDue, formatTaskTime, listLabel, type SortKey } from '../shared/query'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskWorkspace
} from '../shared/types'
import { effectiveDue, subtaskProgress, taskTime, type SectionRow } from '../shared/views'
import { NEXT_STATUS, STATUS_LABELS, nextStatus, setTaskStatus } from './task-actions'
import { PriorityBadge, StatusIcon } from './TaskIcons'
import { PRIORITY_LABELS } from './task-labels'
import { TaskMenu, type MenuGroup } from './TaskMenu'
import { taskRoute } from './tasks-paths'
import styles from './TasksTable.module.css'

type Item =
  | { type: 'task'; key: string; task: Task; kids: Task[] }
  | { type: 'kid'; key: string; task: Task; last: boolean }
  | { type: 'add'; key: string; parent: Task }

/** The rows that are on screen: each task, then (open) all its subtasks and a line to add one, or (closed) only the subtasks that put it here. */
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
  /** `priority` from the badge, `row` from a right-click or the menu key. */
  kind: 'priority' | 'row'
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
  sort
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
}): React.JSX.Element {
  const navigate = useNavigate()
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const items = useMemo(() => buildItems(rows, open), [rows, open])

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
    else void navigate(taskRoute(workspace, item.task.uid))
  })

  const menuGroups = (state: MenuState): MenuGroup[] => {
    const { task } = state
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
    if (task.parentUid) return [status]
    return [
      status,
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
      void setTaskStatus(item.task, NEXT_STATUS[item.task.status])
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
    <div className={styles.wrap}>
      <table ref={tableRef} className={styles.table} aria-label={label} {...tableProps}>
        <colgroup>
          <col className={styles.colStatus} />
          <col />
          <col className={styles.colList} />
          <col className={styles.colPriority} />
          <col className={styles.colTime} />
          <col className={styles.colDue} />
        </colgroup>
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
        <tbody>
          {items.length === 0 && (
            <tr className={styles.emptyRow}>
              <td />
              <td colSpan={5}>{empty ?? 'Nothing here.'}</td>
            </tr>
          )}
          {items.map((item, index) =>
            item.type === 'add' ? (
              <AddSubtaskRow
                key={item.key}
                parent={item.parent}
                workspace={workspace}
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
                today={today}
                tracked={tracked}
                isRunning={running.has(item.task.uid)}
                isOpen={open.has(item.task.uid)}
                rowProps={rowProps(index)}
                onKeyDown={(e) => onRowKeyDown(e, index)}
                onOpen={() => void navigate(taskRoute(workspace, item.task.uid))}
                onToggle={() => toggle(item.task.uid)}
                onAddSubtask={() => startAdding(item.task.uid)}
                onPriorityMenu={(x, y) => setMenu({ task: item.task, x, y, kind: 'priority' })}
                onContextMenu={(x, y) => setMenu({ task: item.task, x, y, kind: 'row' })}
              />
            )
          )}
        </tbody>
      </table>
      {menu && (
        <TaskMenu
          x={menu.x}
          y={menu.y}
          label={menu.kind === 'priority' ? 'Priority' : 'Task'}
          groups={menuGroups(menu)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

async function setPriority(task: Task, priority: TaskPriority): Promise<void> {
  try {
    await window.api.tasks.update(task.uid, { priority })
  } catch (error) {
    showToast(`Couldn’t change the priority: ${ipcErrorMessage(error)}`)
  }
}

type RowProps = ReturnType<ReturnType<typeof useRowNavigation>['rowProps']>

function TaskRowView({
  item,
  today,
  tracked,
  isRunning,
  isOpen,
  rowProps,
  onKeyDown,
  onOpen,
  onToggle,
  onAddSubtask,
  onPriorityMenu,
  onContextMenu
}: {
  item: Extract<Item, { type: 'task' | 'kid' }>
  today: string
  tracked: ReadonlyMap<string, number>
  isRunning: boolean
  isOpen: boolean
  rowProps: RowProps
  onKeyDown: (event: React.KeyboardEvent) => void
  onOpen: () => void
  onToggle: () => void
  onAddSubtask: () => void
  onPriorityMenu: (x: number, y: number) => void
  onContextMenu: (x: number, y: number) => void
}): React.JSX.Element {
  const { task } = item
  const kids = item.type === 'task' ? item.kids : []
  const isKid = item.type === 'kid'
  const due = isKid ? task.due : effectiveDue(task, kids)
  const minutes = taskTime({ task, kids }, tracked).total
  const classes = [
    styles.row,
    isKid && styles.kid,
    isKid && item.last && styles.end,
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
        onContextMenu(
          fromKeyboard ? rect.left + 24 : event.clientX,
          fromKeyboard ? rect.bottom : event.clientY
        )
      }}
    >
      <td>
        <button
          type="button"
          tabIndex={-1}
          className={styles.iconButton}
          title={`${STATUS_LABELS[task.status]} · click for ${STATUS_LABELS[NEXT_STATUS[task.status]]}`}
          aria-label={`Status: ${STATUS_LABELS[task.status]}`}
          onClick={(event) => {
            event.stopPropagation()
            void setTaskStatus(task, nextStatus(task.status, event.shiftKey))
          }}
        >
          <StatusIcon status={task.status} size={isKid ? 18 : 22} />
        </button>
      </td>
      <td>
        <span
          className={[styles.title, task.status === 'done' && styles.titleDone]
            .filter(Boolean)
            .join(' ')}
        >
          {task.title || 'Untitled'}
        </span>
        {task.tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
          </span>
        ))}
        {task.recurrence && (
          <span className={styles.repeat} title={describeRecurrence(task.recurrence)}>
            <Repeat size={14} strokeWidth={1.75} aria-label={describeRecurrence(task.recurrence)} />
          </span>
        )}
        {!isKid && (
          <SubtaskPill kids={kids} open={isOpen} onToggle={onToggle} onAdd={onAddSubtask} />
        )}
      </td>
      <td className={[styles.nowrap, styles.list].join(' ')}>
        {isKid ? '' : listLabel(task.list, task.sublist)}
      </td>
      <td>
        {!isKid && (
          <button
            type="button"
            tabIndex={-1}
            className={styles.iconButton}
            aria-label={`Priority: ${PRIORITY_LABELS[task.priority]}`}
            title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
            onClick={(event) => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              onPriorityMenu(rect.left, rect.bottom + 4)
            }}
          >
            <PriorityBadge priority={task.priority} />
          </button>
        )}
      </td>
      <td className={styles.nowrap}>{formatTaskTime(minutes)}</td>
      <td className={styles.nowrap}>
        {due && (
          <span
            className={styles[`due_${task.status === 'done' ? 'normal' : dueTone(due, today)}`]}
          >
            {formatDue(due, today)}
          </span>
        )}
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
    <button
      type="button"
      tabIndex={-1}
      className={[styles.pill, open && styles.pillOpen].filter(Boolean).join(' ')}
      aria-expanded={open}
      aria-label={`${done} of ${total} subtasks done. ${open ? 'Hide' : 'Show'} subtasks`}
      title={`${done} of ${total} subtasks done`}
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
  )
}

function AddSubtaskRow({
  parent,
  workspace,
  adding,
  rowProps,
  onKeyDown,
  onStart,
  onStop
}: {
  parent: Task
  workspace: TaskWorkspace
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
      className={[styles.row, styles.kid, styles.end, styles.addRow].join(' ')}
      {...rowProps}
      onKeyDown={onKeyDown}
      onClick={onStart}
    >
      <td />
      <td colSpan={5}>
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
