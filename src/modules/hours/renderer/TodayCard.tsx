import { useRef, useState } from 'react'
import { Play, Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { useOpenContracts } from '@renderer/state/use-open-contracts'
import { formatDay, formatHours } from '@shared/tracking/format'
import { dailyAim } from '@shared/tracking/plan'
import { yearOfClient } from '@shared/tracking/contracts'
import { QUARTER } from '@shared/tracking/rounding'
import { dayMinutes, dayRows, type TaskRow } from '@shared/tracking/totals'
import type { RunningTimer } from '@shared/tracking/api'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import type { HoursWorkspace } from '../shared/workspaces'
import { DurationField } from './DurationField'
import { startUnnamed, stopTimer } from './start-request'
import { StaleTimer } from './StaleTimer'
import { TaskPicker, type PickedTask, type TaskPickerHandle } from './TaskPicker'
import { MeetingRows } from './MeetingRows'
import { TaskList } from './TaskList'
import { renameRow } from './rename-row'
import styles from './TodayCard.module.css'

interface TodayCardProps {
  workspace: HoursWorkspace
  data: TrackingYear
  /** The one running timer of the app, wherever it is. */
  running: RunningTimer | null
  now: Moment
}

/**
 * Today: the total against the aim, one row per task, and one form to begin another: a task and a time. With the time at
 * 0:00 it starts the timer (with no task typed, it starts at once and asks which); with a time it adds that much, as if it
 * had been tracked. Either way the task is the picker's: an open one, or a new one made on the spot.
 */
export function TodayCard({ workspace, data, running, now }: TodayCardProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState(0)
  const picker = useRef<TaskPickerHandle>(null)
  // The contracts that hold today (one contract: its own); the task's client decides the contract.
  const { contracts } = useOpenContracts(workspace)
  const own = data.plan.clients ?? []
  const rows = dayRows(data, now.date, now)
  const total = dayMinutes(data, now.date, now)
  const aim = dailyAim(data, now.date)
  const stale = running && running.session.date !== now.date ? running : null
  const tracking = window.api.tracking

  const start = (row: TaskRow): void => {
    if (stale) return
    if (row.task) void tracking.start(workspace, row.label, row.task, row.client)
    else void startUnnamed(workspace, row.label, row.client)
  }
  const adding = minutes > 0
  const ready = adding ? name.trim() !== '' : !stale
  // The picked task: add the time typed, or start the timer on it.
  const picked = async (task: PickedTask): Promise<void> => {
    if (adding) {
      const quarter = Math.max(QUARTER, Math.round(minutes / QUARTER) * QUARTER)
      await tracking.addTime(
        workspace,
        (task.client && yearOfClient(contracts, task.client)) || data.start,
        now.date,
        task.label,
        quarter,
        task.client,
        task.task
      )
    } else if (!stale) await tracking.start(workspace, task.label, task.task, task.client)
    setMinutes(0)
  }
  const submit = (): void => {
    if (!ready) return
    if (name.trim() !== '') picker.current?.submit()
    else void startUnnamed(workspace)
  }

  return (
    <section className={styles.card} aria-label="Today">
      <header className={styles.head}>
        <h2 className={styles.title}>
          Today <span className={styles.date}>{formatDay(now.date)}</span>
        </h2>
        <span className={styles.total}>
          {formatHours(total)}
          {aim !== null && <small> of {formatHours(aim)}</small>}
        </span>
      </header>
      {stale && <StaleTimer running={stale} now={now} />}
      <TaskList
        rows={rows}
        canStart={!stale}
        onStart={start}
        onStop={() => void stopTimer()}
        clients={own}
        onSetClient={(label, from, to) =>
          void tracking.setClient(workspace, data.start, now.date, label, from, to)
        }
        onDelete={(label, rowClient) =>
          void tracking.deleteTaskTime(workspace, data.start, now.date, label, rowClient)
        }
        onSetMinutes={(label, m, rowClient) =>
          void tracking.setTaskMinutes(workspace, data.start, now.date, label, m, rowClient)
        }
        onRename={(label, to, rowClient, task) =>
          renameRow(workspace, data.start, now.date, { label, client: rowClient, task }, to)
        }
      />
      <MeetingRows workspace={workspace} data={data} date={now.date} now={now} />
      <div className={styles.start}>
        <TaskPicker
          ref={picker}
          workspace={workspace}
          label="What are you working on?"
          placeholder="What are you working on?"
          value={name}
          onChange={setName}
          onPick={picked}
        />
        <DurationField label="Time" value={minutes} onChange={setMinutes} onEnter={submit} />
        <Button
          variant="primary"
          icon={
            adding ? (
              <Plus size={14} strokeWidth={1.75} aria-hidden />
            ) : (
              <Play size={14} strokeWidth={1.75} fill="currentColor" aria-hidden />
            )
          }
          disabled={!ready}
          onClick={submit}
        >
          {adding ? 'Add' : 'Start'}
        </Button>
      </div>
    </section>
  )
}
