import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Play, Square } from 'lucide-react'
import { TopBarPortal } from '@renderer/shell/top-bar-slot'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { useSettings } from '@renderer/state/settings-context'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useYearFile } from '@renderer/state/use-year-file'
import { WORKSPACES } from '@shared/settings'
import type { RunningTimer } from '@shared/tracking/api'
import { formatDay, formatHours } from '@shared/tracking/format'
import { dayRows } from '@shared/tracking/totals'
import type { Moment } from '@shared/tracking/types'
import { sameLabel } from '@shared/tracking/timer'
import { elapsedMinutes } from '../shared/timer'
import { StaleTimer } from './StaleTimer'
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
    ? dayRows(data, now.date).filter((r) => !sameLabel(r.label, session.label))
    : []
  const tracking = window.api.tracking

  return (
    <div className={styles.popover} role="dialog" aria-label="Timer">
      <div className={styles.full}>{session.label}</div>
      {clock === null ? (
        <StaleTimer running={running} now={now} />
      ) : (
        <>
          <div className={styles.muted}>
            Started {session.start.slice(0, 5)} · {formatHours(clock)} so far
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

function Chip({ running, now }: { running: RunningTimer; now: Moment }): React.JSX.Element {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLButtonElement>(null)
  const { session } = running
  const clock = elapsedMinutes(session, now)
  const current = WORKSPACES.find((w) => w === pathname.split('/')[1]) ?? settings.ui.workspace

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  return (
    <div
      className={styles.root}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          mainRef.current?.focus()
        }
      }}
    >
      <div className={styles.chip}>
        <button
          ref={mainRef}
          type="button"
          className={styles.main}
          title={session.label}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
        >
          <span className={styles.dot} aria-hidden />
          {running.workspace !== current && (
            <span className={styles.workspace}>{WORKSPACE_LABELS[running.workspace]}</span>
          )}
          <span className={styles.name}>{session.label}</span>
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

/** The running timer in the top bar on every page: the task, the block's clock and Stop. A click opens the popover. */
export function TimerChip(): React.JSX.Element | null {
  const { running } = useRunningTimer()
  const now = useNow(running !== null)
  if (!running) return null
  return (
    <TopBarPortal>
      <Chip running={running} now={now} />
    </TopBarPortal>
  )
}
