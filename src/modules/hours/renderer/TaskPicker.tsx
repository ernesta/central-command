import { useToday } from '@renderer/state/use-today'
import { useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useOpenContracts } from '@renderer/state/use-open-contracts'
import type { OpenContract } from '@shared/tracking/contracts'
import { fold } from '@shared/text'
import { Highlighted } from '@renderer/components/Picker'
import { PickerInput } from '@renderer/components/picker-input'
import { Tooltip } from '@renderer/components/Tooltip'
import { useTaskDefaults } from '../../tasks/renderer/useTaskDefaults'
import { useOpenTasks } from '../../tasks/renderer/useOpenTasks'
import { TaskName } from '../../tasks/renderer/TaskName'
import { parentIn, subtaskParent, taskLabel } from '../../tasks/shared/study-label'
import { TaskSecondLine } from '../../tasks/renderer/TaskSecondLine'
import { ListField } from '../../tasks/renderer/ListField'
import { taskKey } from '../../tasks/shared/tracked'
import type { Task } from '../../tasks/shared/types'
import type { TaskRow } from '../../tasks/shared/views'
import {
  clientForTask,
  detailOfTask,
  listForNew,
  listOfTask,
  pickerOptions
} from '../shared/start-picker'
import type { HoursWorkspace } from '../shared/workspaces'
import styles from './TaskPicker.module.css'

/** What a chosen (or created) task comes to: the entry's name, the task's key and the client its time is for. */
export interface PickedTask {
  label: string
  task: string
  client?: string
}

export interface TaskPickerHandle {
  /** What Enter does with the text typed so far (the exact task, else a new one); false when nothing is typed. */
  submit: () => boolean
}

type Item =
  { kind: 'task'; task: Task } | { kind: 'create'; title: string; list: string; sublist: string }

interface TaskPickerProps {
  workspace: HoursWorkspace
  value: string
  onChange: (value: string) => void
  /** A task was chosen or made, and its client is known (asked for only when it cannot be told). */
  onPick: (picked: PickedTask) => void | Promise<void>
  label: string
  placeholder?: string
  autoFocus?: boolean
  /** The clients to choose among, when the time is for one contract (a past day of it); else the contracts holding today. */
  clients?: readonly string[]
  /** Taken as the client when the task's own cannot be told. */
  hintClient?: string
  /** Offered while nothing is typed. */
  recent?: readonly Task[]
  ref?: React.Ref<TaskPickerHandle>
}

/**
 * The one way to say which task an hour is for. One field: as you type it lists the open tasks that match and always ends
 * with Create "…" in a list, which is shown and can be changed. Choosing one gives its name, key and client back; in Work the client is the task's list, and is
 * asked only when there are several and the list names none of them. Nothing is listed before anything is typed.
 */
export function TaskPicker({
  workspace,
  value,
  onChange,
  onPick,
  label,
  placeholder,
  autoFocus,
  clients,
  hintClient,
  recent = [],
  ref
}: TaskPickerProps): React.JSX.Element {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const today = useToday()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [input] = useState(() => new PickerInput(''))
  const [busy, setBusy] = useState(false)
  const holding = useOpenContracts(workspace)
  const contracts: OpenContract[] = clients
    ? [{ year: '', clients: [...clients] }]
    : holding.contracts
  const tasks = useOpenTasks(workspace)
  const { last } = useTaskDefaults(workspace)

  const [chosenList, setChosenList] = useState<{ list: string; sublist: string } | null>(null)
  const rows = useMemo<TaskRow[]>(
    () => tasks.filter((t) => t.parentUid === null).map((task) => ({ task, kids: [] })),
    [tasks]
  )
  const allClients = contracts.flatMap((c) => c.clients)
  const defaultList = listForNew(tasks, allClients, last.list, hintClient)
  const newList = chosenList ?? {
    list: defaultList,
    sublist: last.list === defaultList ? last.sublist : ''
  }

  const options = useMemo(() => pickerOptions(tasks, value), [tasks, value])
  const items: Item[] = [
    ...options.tasks.map((task): Item => ({ kind: 'task', task })),
    ...(options.create !== null
      ? [{ kind: 'create', title: options.create, ...newList } as Item]
      : [])
  ]
  const shown = open && items.length > 0
  // Where Enter goes with nothing chosen by the arrows: the exact task, else the only match, else Create (the group
  // field's rule). It shows as the highlighted row, so what Enter does is never a surprise.
  const typed = value.trim()
  const exactAt = options.tasks.findIndex((t) => fold(t.title.trim()) === fold(typed))
  const createAt = options.create !== null ? options.tasks.length : -1
  const defaultAt =
    typed === ''
      ? -1
      : exactAt >= 0
        ? exactAt
        : options.tasks.length === 1
          ? 0
          : createAt >= 0
            ? createAt
            : options.tasks.length > 0
              ? 0
              : -1
  const current = active >= 0 ? Math.min(active, items.length - 1) : defaultAt

  const finish = async (item: Item, client: string | undefined): Promise<void> => {
    setBusy(true)
    try {
      if (item.kind === 'task') {
        await onPick({ label: item.task.title.trim(), task: taskKey(item.task.uid), client })
      } else {
        const made = await window.api.tasks.create({
          workspace,
          title: item.title,
          list: item.list,
          sublist: item.sublist
        })
        await onPick({ label: made.title.trim(), task: taskKey(made.uid), client })
      }
      onChange('')
    } finally {
      setBusy(false)
      setOpen(false)
      setActive(-1)
      setChosenList(null)
    }
  }

  const choose = (item: Item): void => {
    if (busy) return
    const list = item.kind === 'task' ? listOfTask(item.task, tasks) : item.list
    void finish(item, clientForTask(contracts, list))
  }

  // Enter with nothing chosen by the arrows: what is highlighted by default, or a new task when nothing fits.
  const submit = (): boolean => {
    if (typed === '') return false
    const at = shown ? defaultAt : -1
    choose(at >= 0 && at < items.length ? items[at] : { kind: 'create', title: typed, ...newList })
    return true
  }
  useImperativeHandle(ref, () => ({ submit }))

  const keys = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!shown) return
      event.preventDefault()
      input.markMoved()
      const step = event.key === 'ArrowDown' ? 1 : -1
      // The list wraps, so Down from the default Create row (the last) goes to the first task, not nowhere.
      setActive(
        ((((current < 0 && step < 0 ? items.length : current) + step) % items.length) +
          items.length) %
          items.length
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (shown && current >= 0) choose(items[current])
      else submit()
    } else if (event.key === 'Tab' && !event.shiftKey && shown && current >= 0 && input.moved) {
      // Tab takes the row the arrows led to (never a typed-for default: it could make a task) and moves on.
      choose(items[current])
    } else if (event.key === 'Escape' && shown) {
      // Only the list closes, not the popover or form behind it.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <input
        className={styles.input}
        role="combobox"
        aria-label={label}
        aria-expanded={shown}
        aria-controls={shown ? listId : undefined}
        aria-activedescendant={shown && current >= 0 ? `${listId}-${current}` : undefined}
        aria-autocomplete="list"
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => {
          onChange(event.target.value.replace(/[\r\n]/g, ''))
          setOpen(true)
          setActive(-1)
          input.reset()
        }}
        onKeyDown={keys}
        onBlur={(event) => {
          // Moving into the list field of the Create row keeps the list open.
          if (!event.relatedTarget || !rootRef.current?.contains(event.relatedTarget as Node))
            setOpen(false)
        }}
      />
      {shown && (
        <div id={listId} className={styles.list} role="listbox" aria-label={label}>
          {items.map((item, index) => (
            <div
              key={item.kind === 'task' ? item.task.uid : 'create'}
              className={
                item.kind === 'create'
                  ? [styles.createRow, index > 0 && styles.createDivided].filter(Boolean).join(' ')
                  : undefined
              }
            >
              <div
                id={`${listId}-${index}`}
                role="option"
                aria-selected={false}
                data-active={index === current}
                className={[styles.option, item.kind === 'create' && styles.create]
                  .filter(Boolean)
                  .join(' ')}
                onMouseMove={(event) => {
                  // Only a real pointer move highlights, as in every picker.
                  if (input.pointerMoved(event.clientX, event.clientY)) setActive(index)
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                {item.kind === 'task' ? (
                  <>
                    <span className={styles.optionTitle}>
                      <TaskName
                        task={item.task}
                        parent={parentIn(item.task, tasks)}
                        title={
                          <Highlighted
                            label={taskLabel(item.task, parentIn(item.task, tasks))}
                            query={value}
                          />
                        }
                      />
                    </span>
                    <span className={styles.detail}>
                      <TaskSecondLine
                        parent={subtaskParent(item.task, tasks)}
                        list={detailOfTask(item.task, tasks)}
                        task={item.task}
                        today={today}
                      />
                    </span>
                  </>
                ) : (
                  <>
                    <Plus size={14} strokeWidth={1.75} aria-hidden />
                    <Tooltip text={`Create “${item.title}”`} whenCut>
                      <span className={styles.createTitle}>Create “{item.title}”</span>
                    </Tooltip>
                    <span className={styles.createIn}>in</span>
                  </>
                )}
              </div>
              {item.kind === 'create' && (
                <div className={styles.createList}>
                  <ListField
                    workspace={workspace}
                    list={item.list}
                    sublist={item.sublist}
                    rows={rows}
                    onChange={setChosenList}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {value.trim() === '' && recent.length > 0 && (
        <div className={styles.group}>
          <span className={styles.heading}>Suggested</span>
          <ul className={styles.choices}>
            {recent.map((task) => (
              <li key={task.uid}>
                <button
                  type="button"
                  className={styles.choice}
                  onClick={() => choose({ kind: 'task', task })}
                >
                  <span className={styles.optionTitle}>
                    <TaskName task={task} parent={parentIn(task, tasks)} />
                  </span>
                  <span className={styles.detail}>
                    <TaskSecondLine
                      parent={subtaskParent(task, tasks)}
                      list={detailOfTask(task, tasks)}
                      task={task}
                      today={today}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
