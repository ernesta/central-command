import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Play, Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { Select } from '@renderer/components/Select'
import { useOpenContracts } from '@renderer/state/use-open-contracts'
import { formatDay, formatHours } from '@shared/tracking/format'
import { dailyAim } from '@shared/tracking/plan'
import { contractName, yearOfClient } from '@shared/tracking/contracts'
import { defaultClient, sameLabel } from '@shared/tracking/timer'
import { QUARTER } from '@shared/tracking/rounding'
import { dayMinutes, dayRows } from '@shared/tracking/totals'
import type { RunningTimer } from '@shared/tracking/api'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { earlierLabels } from '../shared/tasks'
import type { HoursWorkspace } from '../shared/workspaces'
import { DurationField } from './DurationField'
import { StaleTimer } from './StaleTimer'
import { listForNewTask } from '../../tasks/shared/new-task-list'
import { taskKey, taskKeyForLabel } from '../../tasks/shared/tracked'
import { useTaskDefaults } from '../../tasks/renderer/useTaskDefaults'
import { useOpenTasks } from '../../tasks/renderer/useOpenTasks'
import { TaskField } from './TaskField'
import { TaskList } from './TaskList'
import styles from './TodayCard.module.css'

interface TodayCardProps {
  workspace: HoursWorkspace
  data: TrackingYear
  /** The one running timer of the app, wherever it is. */
  running: RunningTimer | null
  now: Moment
}

/**
 * Today: the total against the aim, one row per task, and one form to begin another: a name and a time. With the
 * time at 0:00 it starts the timer (a name can wait); with a time it adds that much, as if it had been tracked.
 */
export function TodayCard({ workspace, data, running, now }: TodayCardProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  // The clients of every contract that holds today (one contract: its own); the client decides the contract.
  const { contracts } = useOpenContracts(workspace)
  const own = data.plan.clients ?? []
  const offered = contracts.length > 1 ? contracts.flatMap((c) => c.clients) : own
  const client = picked !== null && offered.includes(picked) ? picked : defaultClient(data)
  const clientOptions = offered.map((c) => ({
    value: c,
    label: c,
    ...(contracts.length > 1
      ? { group: contractName(contracts.find((x) => x.clients.includes(c))) }
      : {})
  }))
  const rows = dayRows(data, now.date, now)
  const total = dayMinutes(data, now.date, now)
  const aim = dailyAim(data, now.date)
  // Open tasks are offered by name too; a name that is exactly one of them links the time to it.
  const openTasks = useOpenTasks(workspace)
  const isWork = workspace === 'work'
  const { last } = useTaskDefaults('work')
  const labels = useMemo(() => {
    const earlier = earlierLabels(data)
    const titles = openTasks
      .map((t) => t.title.trim())
      .filter((t) => t && !earlier.some((l) => sameLabel(l, t)))
    return [...earlier, ...new Set(titles)]
  }, [data, openTasks])
  const stale = running && running.session.date !== now.date ? running : null
  const tracking = window.api.tracking
  const startRef = useRef<HTMLDivElement>(null)
  const { state, key } = useLocation() as { state: { focus?: string } | null; key: string }
  const wantsFocus = state?.focus === 'start'

  // "Start timer" in the palette arrives here asking for the field (a fresh location key each time).
  useEffect(() => {
    if (wantsFocus) startRef.current?.querySelector('input')?.focus()
  }, [wantsFocus, key])

  // The task a typed name stands for: the open one it names, else (Work only) a new one, so every hour has a task.
  const keyFor = async (label: string): Promise<string | undefined> => {
    const found = taskKeyForLabel(openTasks, label)
    const list = listForNewTask(openTasks, last.list)
    if (found || !isWork || label.trim() === '' || !list) return found
    const made = await window.api.tasks.create({
      workspace: 'work',
      title: label.trim(),
      list,
      sublist: last.list === list ? last.sublist : '',
      due: now.date
    })
    return taskKey(made.uid)
  }
  const start = (label: string, forClient = client, fresh = false): void => {
    if (stale) return
    void (fresh ? keyFor(label) : Promise.resolve(taskKeyForLabel(openTasks, label))).then((key) =>
      tracking.start(workspace, label, key, forClient)
    )
  }
  const adding = minutes > 0
  const ready = adding ? name.trim() !== '' : !stale
  const submit = (): void => {
    if (!ready) return
    if (adding) {
      const quarter = Math.max(QUARTER, Math.round(minutes / QUARTER) * QUARTER)
      void keyFor(name).then((key) =>
        tracking.addTime(
          workspace,
          (client && yearOfClient(contracts, client)) || data.start,
          now.date,
          name,
          quarter,
          client,
          key
        )
      )
    } else start(name, client, true)
    setName('')
    setMinutes(0)
    setPicked(null)
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
        onStart={(label, rowClient) => start(label, rowClient)}
        onStop={() => void tracking.stop()}
        clients={own}
        onSetClient={(label, from, to) =>
          void tracking.setClient(workspace, data.start, now.date, label, from, to)
        }
        onSetMinutes={(label, m, rowClient) =>
          void tracking.setTaskMinutes(workspace, data.start, now.date, label, m, rowClient)
        }
        onRename={(label, to, rowClient) =>
          void tracking.renameTask(workspace, data.start, now.date, label, to, rowClient)
        }
      />
      <div className={styles.start} ref={startRef}>
        <TaskField
          label="What are you working on?"
          placeholder="What are you working on?"
          value={name}
          onChange={setName}
          onSubmit={submit}
          labels={labels}
        />
        {offered.length > 0 && (
          <Select
            label="Client"
            value={client ?? offered[0]}
            options={clientOptions}
            onChange={setPicked}
          />
        )}
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
