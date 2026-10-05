import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Play, Plus } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { Select } from '@renderer/components/Select'
import { formatDay, formatHours } from '@shared/tracking/format'
import { dailyAim } from '@shared/tracking/plan'
import { defaultClient, sameLabel } from '@shared/tracking/timer'
import { QUARTER } from '@shared/tracking/rounding'
import { dayMinutes, dayRows } from '@shared/tracking/totals'
import type { RunningTimer } from '@shared/tracking/api'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { earlierLabels } from '../shared/tasks'
import type { HoursWorkspace } from '../shared/workspaces'
import { DurationField } from './DurationField'
import { StaleTimer } from './StaleTimer'
import { taskKeyForLabel } from '../../tasks/shared/tracked'
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
  const clients = data.plan.clients ?? []
  const client = picked !== null && clients.includes(picked) ? picked : defaultClient(data)
  const rows = dayRows(data, now.date, now)
  const total = dayMinutes(data, now.date, now)
  const aim = dailyAim(data, now.date)
  // Open tasks are offered by name too; a name that is exactly one of them links the time to it.
  const openTasks = useOpenTasks(workspace)
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

  const start = (label: string, forClient = client): void => {
    if (!stale) void tracking.start(workspace, label, taskKeyForLabel(openTasks, label), forClient)
  }
  const adding = minutes > 0
  const ready = adding ? name.trim() !== '' : !stale
  const submit = (): void => {
    if (!ready) return
    if (adding) {
      const quarter = Math.max(QUARTER, Math.round(minutes / QUARTER) * QUARTER)
      void tracking.addTime(
        workspace,
        data.start,
        now.date,
        name,
        quarter,
        client,
        taskKeyForLabel(openTasks, name)
      )
    } else start(name)
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
        clients={clients}
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
        {clients.length > 0 && (
          <Select
            label="Client"
            value={client ?? clients[0]}
            options={clients.map((c) => ({ value: c, label: c }))}
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
