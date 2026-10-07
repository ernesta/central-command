import { useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { TaskPicker, type PickedTask } from '../../hours/renderer/TaskPicker'
import { useTasksList } from '../../tasks/renderer/useTasksList'
import { useWorkClients } from '../../tasks/renderer/useWorkClients'
import { taskUidOf } from '../../tasks/shared/tracked'
import { listOfTask } from '../../hours/shared/start-picker'
import { proposeMeetingTask } from '../shared/meeting-task'
import type { MeetingWorkspace } from '../shared/types'
import styles from './MeetingTask.module.css'

interface MeetingTaskProps {
  workspace: MeetingWorkspace
  series: string
  /** The uid of the meeting's task; '' when it has none. */
  task: string
  onChange: (task: string) => void
}

/**
 * The task a meeting's hours belong to. With none it offers the one its series calls for, pre-filled: one click takes it (an
 * existing task is used, otherwise it is created with the generic title); "Other" opens the picker for any task. With one it
 * shows it, and Change opens the picker. Nothing is chosen for you: the file only changes when you click.
 */
export function MeetingTask({
  workspace,
  series,
  task,
  onChange
}: MeetingTaskProps): React.JSX.Element {
  const { tasks } = useTasksList(workspace)
  const clients = useWorkClients(workspace)
  const [choosing, setChoosing] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)

  const all = tasks ?? []
  const current = task ? all.find((t) => t.uid === task) : undefined
  const open = all.filter((t) => t.status !== 'done')
  const proposal = proposeMeetingTask(workspace, series, clients, open)

  const stop = (): void => {
    setChoosing(false)
    setTyped('')
    // Back to the button that opened it.
    requestAnimationFrame(() => opener.current?.focus())
  }
  const picked = (picked: PickedTask): void => {
    const uid = taskUidOf(picked.task)
    if (uid) onChange(uid)
    stop()
  }
  const accept = async (): Promise<void> => {
    if (!proposal || busy) return
    if (proposal.existing) {
      onChange(proposal.existing.uid)
      return
    }
    setBusy(true)
    try {
      const made = await window.api.tasks.create({
        workspace,
        title: proposal.title,
        list: proposal.list
      })
      onChange(made.uid)
    } finally {
      setBusy(false)
    }
  }

  if (choosing) {
    return (
      <div
        className={styles.picker}
        onKeyDown={(event) => {
          // The picker closes its own list first; a second Escape leaves the picker, not the page.
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            event.stopPropagation()
            stop()
          }
        }}
      >
        <TaskPicker
          workspace={workspace}
          label="Task"
          placeholder="Find or create a task"
          autoFocus
          value={typed}
          onChange={setTyped}
          onPick={picked}
        />
      </div>
    )
  }

  if (current) {
    return (
      <div className={styles.row}>
        <span className={styles.value}>
          <span className={styles.title}>{current.title}</span>
          <span className={styles.list}>{listOfTask(current, all)}</span>
        </span>
        <button
          ref={opener}
          type="button"
          className={styles.link}
          onClick={() => setChoosing(true)}
          aria-label="Change the task"
        >
          Change
        </button>
        <button
          type="button"
          className={styles.icon}
          onClick={() => onChange('')}
          aria-label="No task"
          title="No task"
        >
          <X size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    )
  }

  // A task that is no longer there (deleted, or the note moved workspace) is as good as none.
  if (proposal) {
    return (
      <div className={styles.row}>
        <button
          type="button"
          className={styles.propose}
          disabled={busy}
          onClick={() => void accept()}
          aria-label={
            proposal.existing
              ? `Use the task ${proposal.title}`
              : `Create the task ${proposal.title}`
          }
        >
          {proposal.existing ? (
            <Check size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <Plus size={14} strokeWidth={1.75} aria-hidden />
          )}
          <span className={styles.title}>{proposal.title}</span>
          <span className={styles.list}>{proposal.list}</span>
        </button>
        <button
          ref={opener}
          type="button"
          className={styles.link}
          onClick={() => setChoosing(true)}
        >
          Other
        </button>
      </div>
    )
  }

  return (
    <div className={styles.row}>
      <button ref={opener} type="button" className={styles.link} onClick={() => setChoosing(true)}>
        Choose a task
      </button>
    </div>
  )
}
