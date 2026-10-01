import { useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { formatDay, formatHours } from '@shared/tracking/format'
import { dailyAim } from '@shared/tracking/plan'
import { dayMinutes, dayRows } from '@shared/tracking/totals'
import type { RunningTimer } from '@shared/tracking/api'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import { earlierLabels } from '../shared/tasks'
import type { HoursWorkspace } from '../shared/workspaces'
import { AddTime } from './AddTime'
import { StaleTimer } from './StaleTimer'
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
