import { useId, useImperativeHandle, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useOpenContracts } from '@renderer/state/use-open-contracts'
import type { OpenContract } from '@shared/tracking/contracts'
import { fold } from '@shared/text'
import { useTaskDefaults } from '../../tasks/renderer/useTaskDefaults'
import { useOpenTasks } from '../../tasks/renderer/useOpenTasks'
import { taskKey } from '../../tasks/shared/tracked'
import type { Task } from '../../tasks/shared/types'
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

type Item = { kind: 'task'; task: Task } | { kind: 'create'; title: string }

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
 * with Create task "…". Choosing one gives its name, key and client back; in Work the client is the task's list, and is
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
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [asking, setAsking] = useState<{ item: Item; clients: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const holding = useOpenContracts(workspace)
  const contracts: OpenContract[] = clients
    ? [{ year: '', clients: [...clients] }]
    : holding.contracts
  const tasks = useOpenTasks(workspace)
  const { last } = useTaskDefaults(workspace)

  const options = useMemo(() => pickerOptions(tasks, value), [tasks, value])
  const items: Item[] = [
    ...options.tasks.map((task): Item => ({ kind: 'task', task })),
    ...(options.create !== null ? [{ kind: 'create', title: options.create } as Item] : [])
  ]
  const shown = open && items.length > 0

  const finish = async (item: Item, client: string | undefined): Promise<void> => {
    setBusy(true)
    try {
      if (item.kind === 'task') {
        await onPick({ label: item.task.title.trim(), task: taskKey(item.task.uid), client })
      } else {
        const list = listForNew(tasks, client, last.list)
        const made = await window.api.tasks.create({
          workspace,
          title: item.title,
          list,
          sublist: last.list === list ? last.sublist : ''
        })
        await onPick({ label: made.title.trim(), task: taskKey(made.uid), client })
      }
      onChange('')
    } finally {
      setBusy(false)
      setAsking(null)
      setOpen(false)
      setActive(-1)
    }
  }

  const choose = (item: Item): void => {
    if (busy) return
    const list = item.kind === 'task' ? listOfTask(item.task, tasks) : ''
    const found = clientForTask(contracts, list)
    if (found.ask && hintClient && found.ask.includes(hintClient)) void finish(item, hintClient)
    else if (found.ask) setAsking({ item, clients: found.ask })
    else void finish(item, found.client)
  }

  // Enter with nothing highlighted: the task whose title is exactly what was typed, else a new one.
  const submit = (): boolean => {
    if (value.trim() === '') return false
    const exact = options.tasks.find((t) => fold(t.title.trim()) === fold(value.trim()))
    choose(exact ? { kind: 'task', task: exact } : { kind: 'create', title: value.trim() })
    return true
  }
  useImperativeHandle(ref, () => ({ submit }))

  const keys = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!shown) return
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((a) => Math.min(items.length - 1, Math.max(0, a + step)))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (shown && active >= 0) choose(items[active])
      else submit()
    } else if (event.key === 'Escape' && (shown || asking)) {
      // Only the list (or the question) closes, not the popover or form behind it.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      setAsking(null)
    }
  }

  return (
    <div className={styles.root}>
      <input
        className={styles.input}
        role="combobox"
        aria-label={label}
        aria-expanded={shown}
        aria-controls={shown ? listId : undefined}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => {
          onChange(event.target.value.replace(/[\r\n]/g, ''))
          setOpen(true)
          setActive(-1)
          setAsking(null)
        }}
        onKeyDown={keys}
        onBlur={() => setOpen(false)}
      />
      {shown && !asking && (
        <div id={listId} className={styles.list} role="listbox" aria-label={label}>
          {items.map((item, index) => (
            <div
              key={item.kind === 'task' ? item.task.uid : 'create'}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              data-active={index === active}
              className={[styles.option, item.kind === 'create' && styles.create]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              {item.kind === 'task' ? (
                <>
                  <span className={styles.optionTitle}>{item.task.title}</span>
                  <span className={styles.detail}>{detailOfTask(item.task, tasks)}</span>
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={1.75} aria-hidden />
                  <span className={styles.optionTitle}>Create task “{item.title}”</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {asking && (
        <div className={styles.group} role="group" aria-label="Client">
          <span className={styles.heading}>Which client?</span>
          <ul className={styles.choices}>
            {asking.clients.map((client) => (
              <li key={client}>
                <button
                  type="button"
                  className={styles.choice}
                  autoFocus={client === asking.clients[0]}
                  onClick={() => void finish(asking.item, client)}
                >
                  {client}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!asking && value.trim() === '' && recent.length > 0 && (
        <div className={styles.group}>
          <span className={styles.heading}>Recent</span>
          <ul className={styles.choices}>
            {recent.map((task) => (
              <li key={task.uid}>
                <button
                  type="button"
                  className={styles.choice}
                  onClick={() => choose({ kind: 'task', task })}
                >
                  <span className={styles.optionTitle}>{task.title}</span>
                  <span className={styles.detail}>{detailOfTask(task, tasks)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
