import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { formatDay, formatHours } from '@shared/tracking/format'
import { dailyAim } from '@shared/tracking/plan'
import { dayMinutes, dayRows } from '@shared/tracking/totals'
import type { RunningTimer } from '@shared/tracking/api'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { addDays } from '@shared/year'
import { earlierLabels } from '../shared/tasks'
import type { HoursWorkspace } from '../shared/workspaces'
import { AddTime } from './AddTime'
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

/** A timer left running on an earlier day does not stop by itself: it needs an end time before anything else can start. */
function StaleTimer({ running, now }: { running: RunningTimer; now: Moment }): React.JSX.Element {
  const [time, setTime] = useState('')
  const { session } = running
  const since = session.date === addDays(now.date, -1) ? 'yesterday' : formatDay(session.date)
  const ready = time !== '' && time > session.start.slice(0, 5)
  const end = (): void => {
    if (ready)
      void window.api.tracking.endAt(running.workspace, running.year, session.id, `${time}:00`)
  }
  return (
    <div className={styles.stale}>
      <span>
        Started {since} {session.start.slice(0, 5)}. Set an end time.
      </span>
      <input
        type="time"
        className={styles.clock}
        aria-label="End time"
        value={time}
        onChange={(event) => setTime(event.target.value)}
      />
      <Button size="small" variant="primary" disabled={!ready} onClick={end}>
        End
      </Button>
    </div>
  )
}

/** Today: the total against the aim, one row per task, the field to start another and a quiet Add. */
export function TodayCard({ workspace, data, running, now }: TodayCardProps): React.JSX.Element {
  const [name, setName] = useState('')
  const rows = dayRows(data, now.date, now)
  const total = dayMinutes(data, now.date, now)
  const aim = dailyAim(data, now.date)
  const labels = useMemo(() => earlierLabels(data), [data])
  const stale = running && running.session.date !== now.date ? running : null
  const tracking = window.api.tracking

  const start = (label: string): void => {
    if (label.trim() && !stale) void tracking.start(workspace, label)
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
        onStop={() => void tracking.stop()}
        onSetMinutes={(label, minutes) =>
          void tracking.setTaskMinutes(workspace, data.start, now.date, label, minutes)
        }
      />
      <div className={styles.start}>
        <TaskField
          label="What are you working on?"
          placeholder="What are you working on?"
          value={name}
          onChange={setName}
          onSubmit={() => {
            start(name)
            setName('')
          }}
          labels={labels}
        />
        <Button
          variant="primary"
          icon={<Play size={14} strokeWidth={1.75} fill="currentColor" aria-hidden />}
          disabled={!name.trim() || stale !== null}
          onClick={() => {
            start(name)
            setName('')
          }}
        >
          Start
        </Button>
      </div>
      <AddTime
        labels={labels}
        onAdd={(label, minutes) =>
          void tracking.addTime(workspace, data.start, now.date, label, minutes)
        }
      />
    </section>
  )
}
