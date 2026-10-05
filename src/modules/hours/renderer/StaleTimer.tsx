import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { TimeInput } from '@renderer/components/TimeInput'
import { clockTime, formatDay } from '@shared/tracking/format'
import type { RunningTimer } from '@shared/tracking/api'
import type { Moment } from '@shared/tracking/types'
import { addDays } from '@shared/year'
import styles from './StaleTimer.module.css'

/** A timer left running on an earlier day does not stop by itself: it needs an end time before anything else can start. */
export function StaleTimer({
  running,
  now
}: {
  running: RunningTimer
  now: Moment
}): React.JSX.Element {
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
        Started {since} {clockTime(session.start)}. Set an end time.
      </span>
      <TimeInput aria-label="End time" value={time} onChange={(value) => setTime(value ?? '')} />
      <Button size="small" variant="primary" disabled={!ready} onClick={end}>
        End
      </Button>
    </div>
  )
}
