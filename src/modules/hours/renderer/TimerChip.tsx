import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Play, Square } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { TopBarPortal } from '@renderer/shell/top-bar-slot'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { useSettings } from '@renderer/state/settings-context'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useYearFile } from '@renderer/state/use-year-file'
import { WORKSPACES } from '@shared/settings'
import { trackingMoment } from '@shared/time'
import type { RunningTimer } from '@shared/tracking/api'
import { clockTime, formatDay, formatHours } from '@shared/tracking/format'
import { dayRows } from '@shared/tracking/totals'
import type { Moment } from '@shared/tracking/types'
import { sameLabel } from '@shared/tracking/timer'
import { currentYear } from '@shared/year'
import { earlierLabels, recentLabels } from '../shared/tasks'
import { elapsedMinutes } from '../shared/timer'
import { StaleTimer } from './StaleTimer'
import { TaskField } from './TaskField'
import styles from './TimerChip.module.css'

/** What the popover offers: stop, or switch to another task of today. A timer from an earlier day only asks for its end. */
function TimerPopover({
  running,
  now,
  clock,
  onClose
}: {
  running: RunningTimer
  now: Moment
  clock: number | null
  onClose: () => void
}): React.JSX.Element {
  const { session } = running
  const data = useYearFile(running.workspace, running.year)
  const others = data
    ? dayRows(data, now.date).filter((r) => r.label !== '' && !sameLabel(r.label, session.label))
    : []
  const tracking = window.api.tracking

  return (
    <div className={styles.popover} role="dialog" aria-label="Timer">
      <div className={styles.full}>{session.label || 'No name yet'}</div>
      {clock === null ? (
        <StaleTimer running={running} now={now} />
      ) : (
        <>
          <div className={styles.muted}>
            Started {clockTime(session.start)} · {formatHours(clock)} so far
          </div>
          {others.length > 0 && (
            <div className={styles.switch}>
              <span className={styles.label}>Switch to</span>
              <ul className={styles.options}>
                {others.map((row) => (
                  <li key={row.label.toLowerCase()}>
                    <button
                      type="button"
                      className={styles.option}
                      onClick={() => {
                        void tracking.start(running.workspace, row.label)
                        onClose()
                      }}
                    >
                      <Play size={14} strokeWidth={1.75} fill="currentColor" aria-hidden />
                      <span>{row.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className={styles.stopButton}
            onClick={() => {
              void tracking.stop()
              onClose()
            }}
          >
            <Square size={12} strokeWidth={1.75} fill="currentColor" aria-hidden />
            Stop
          </button>
        </>
      )}
    </div>
  )
}

/** Open/closed for a chip's popover: a click outside or Escape closes it, and Escape returns focus to the chip's button. */
function usePopover(): {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  rootRef: React.RefObject<HTMLDivElement | null>
  mainRef: React.RefObject<HTMLButtonElement | null>
  onKeyDown: (event: React.KeyboardEvent) => void
} {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      mainRef.current?.focus()
    }
  }
  return { open, setOpen, rootRef, mainRef, onKeyDown }
}

function Chip({ running, now }: { running: RunningTimer; now: Moment }): React.JSX.Element {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const { open, setOpen, rootRef, mainRef, onKeyDown } = usePopover()
  const { session } = running
  const clock = elapsedMinutes(session, now)
  const current = WORKSPACES.find((w) => w === pathname.split('/')[1]) ?? settings.ui.workspace

  return (
    <div className={styles.root} ref={rootRef} onKeyDown={onKeyDown}>
      <div className={styles.chip}>
        <button
          ref={mainRef}
          type="button"
          className={styles.main}
          title={session.label || undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
        >
          <span className={styles.dot} aria-hidden />
          {running.workspace !== current && (
            <span className={styles.workspace}>{WORKSPACE_LABELS[running.workspace]}</span>
          )}
          <span className={styles.name}>{session.label || 'No name yet'}</span>
          <span className={styles.clock}>
            {clock === null ? formatDay(session.date) : formatHours(clock)}
          </span>
        </button>
        {clock !== null && (
          <button
            type="button"
            className={styles.stop}
            onClick={() => void window.api.tracking.stop()}
          >
            Stop
          </button>
        )}
      </div>
      {open && (
        <TimerPopover running={running} now={now} clock={clock} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

/** What the idle popover offers: a task name to start, and the names of the last week as one-click starts. */
function StartPopover({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { settings } = useSettings()
  const today = trackingMoment().date
  const data = useYearFile('research', currentYear(today, settings.yearStarts))
  const [name, setName] = useState('')
  const labels = useMemo(() => (data ? earlierLabels(data) : []), [data])
  const recent = useMemo(() => (data ? recentLabels(data, today) : []), [data, today])

  const start = (label: string): void => {
    void window.api.tracking.start('research', label)
    onClose()
  }

  return (
    <div className={styles.popover} role="dialog" aria-label="Start timer">
      <div className={styles.startRow}>
        <TaskField
          label="What are you working on?"
          placeholder="What are you working on?"
          value={name}
          onChange={setName}
          onSubmit={() => start(name)}
          labels={labels}
          autoFocus
        />
        <Button
          variant="primary"
          icon={<Play size={14} strokeWidth={1.75} fill="currentColor" aria-hidden />}
          onClick={() => start(name)}
        >
          Start
        </Button>
      </div>
      {recent.length > 0 && (
        <div className={styles.switch}>
          <span className={styles.label}>Recent</span>
          <ul className={styles.options}>
            {recent.map((label) => (
              <li key={label.toLowerCase()}>
                <button type="button" className={styles.option} onClick={() => start(label)}>
                  <Play size={14} strokeWidth={1.75} fill="currentColor" aria-hidden />
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** No timer runs: a quiet Start in the running chip's place, opening the field and the recent names. */
function IdleChip(): React.JSX.Element {
  const { open, setOpen, rootRef, mainRef, onKeyDown } = usePopover()
  return (
    <div className={styles.root} ref={rootRef} onKeyDown={onKeyDown}>
      <div className={styles.chip}>
        <button
          ref={mainRef}
          type="button"
          className={styles.main}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
        >
          <Play size={12} strokeWidth={1.75} fill="currentColor" aria-hidden />
          Start
        </button>
      </div>
      {open && <StartPopover onClose={() => setOpen(false)} />}
    </div>
  )
}

/**
 * The timer in the top bar on every page. Running: the task, the block's clock and Stop; a click opens the popover.
 * Otherwise a Start that opens the task field and the recent names.
 */
export function TimerChip(): React.JSX.Element | null {
  const { running, loaded } = useRunningTimer()
  const now = useNow(running !== null)
  // Nothing until it is known whether a timer runs, or the bar would flash Start.
  if (!loaded) return null
  return (
    <TopBarPortal>{running ? <Chip running={running} now={now} /> : <IdleChip />}</TopBarPortal>
  )
}
