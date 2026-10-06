import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Play, Square } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { Select } from '@renderer/components/Select'
import { TopBarPortal } from '@renderer/shell/top-bar-slot'
import { useQuickActionWorkspace } from '@renderer/shell/useQuickActionWorkspace'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { useSettings } from '@renderer/state/settings-context'
import { useNow } from '@renderer/state/use-now'
import { useOpenContracts } from '@renderer/state/use-open-contracts'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useYearFile } from '@renderer/state/use-year-file'
import { WORKSPACES } from '@shared/settings'
import type { RunningTimer } from '@shared/tracking/api'
import { contractName } from '@shared/tracking/contracts'
import { clockTime, formatDay, formatHours } from '@shared/tracking/format'
import { dayRows } from '@shared/tracking/totals'
import type { Moment } from '@shared/tracking/types'
import { sameClient, sameLabel } from '@shared/tracking/timer'
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
    ? dayRows(data, now.date).filter(
        (r) =>
          r.label !== '' &&
          !(sameLabel(r.label, session.label) && sameClient(r.client, session.client))
      )
    : []
  const clients = data?.plan.clients ?? []
  const tracking = window.api.tracking
  const [name, setName] = useState('')
  const labels = useMemo(() => (data ? earlierLabels(data) : []), [data])
  const recent = useMemo(
    () => (data ? recentLabels(data, now.date).filter((l) => !sameLabel(l, session.label)) : []),
    [data, now.date, session.label]
  )
  const unnamed = session.label.trim() === ''
  // Naming the running task renames this day's unnamed blocks; a name already used today merges into it.
  const rename = (to: string): void => {
    if (!to.trim()) return
    void tracking.renameTask(
      running.workspace,
      running.year,
      session.date,
      session.label,
      to,
      session.client
    )
    onClose()
  }

  return (
    <div className={styles.popover} role="dialog" aria-label="Timer">
      {unnamed && clock !== null ? (
        <>
          <div className={styles.startRow}>
            <TaskField
              label="What are you working on?"
              placeholder="What are you working on?"
              value={name}
              onChange={setName}
              onSubmit={() => rename(name)}
              labels={labels}
              autoFocus
            />
            <Button variant="primary" onClick={() => rename(name)}>
              Name
            </Button>
          </div>
          {recent.length > 0 && (
            <div className={styles.switch}>
              <span className={styles.label}>Recent</span>
              <ul className={styles.options}>
                {recent.map((label) => (
                  <li key={label.toLowerCase()}>
                    <button type="button" className={styles.option} onClick={() => rename(label)}>
                      <span>{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className={styles.full}>{session.label || 'No name yet'}</div>
      )}
      {clients.length > 0 && (
        <Select
          compact
          label="Client"
          value={session.client ?? ''}
          options={[
            ...(session.client === undefined ? [{ value: '', label: 'No client' }] : []),
            ...clients.map((c) => ({ value: c, label: c }))
          ]}
          onChange={(to) =>
            to &&
            void tracking.setClient(
              running.workspace,
              running.year,
              session.date,
              session.label,
              session.client,
              to
            )
          }
        />
      )}
      {clock === null ? (
        <StaleTimer running={running} now={now} />
      ) : (
        <>
          <div className={styles.muted}>
            Started {clockTime(session.start)} · {formatHours(clock)} so far
          </div>
          {!unnamed && others.length > 0 && (
            <div className={styles.switch}>
              <span className={styles.label}>Switch to</span>
              <ul className={styles.options}>
                {others.map((row) => (
                  <li key={`${row.client ?? ''}\n${row.label.toLowerCase()}`}>
                    <button
                      type="button"
                      className={styles.option}
                      onClick={() => {
                        void tracking.start(running.workspace, row.label, undefined, row.client)
                        onClose()
                      }}
                    >
                      <Play size={14} strokeWidth={1.75} fill="currentColor" aria-hidden />
                      <span>{row.label}</span>
                      {row.client && <span className={styles.optionClient}>{row.client}</span>}
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

/** Set by the idle Start so the chip that replaces it opens its popover, ready for a name. */
let openAfterStart = false

function Chip({ running, now }: { running: RunningTimer; now: Moment }): React.JSX.Element {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const { open, setOpen, rootRef, mainRef, onKeyDown } = usePopover()
  useEffect(() => {
    if (!openAfterStart) return
    openAfterStart = false
    setOpen(true)
  }, [setOpen])
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

/**
 * No timer runs: a quiet Start in the running chip's place. It starts at once, unnamed; the chip then asks for a name.
 * Where several clients could be started for (Work, with overlapping contracts) a Client menu sits before it,
 * on the client used last; the client decides the contract.
 */
function IdleChip(): React.JSX.Element {
  const workspace = useQuickActionWorkspace()
  const { contracts, last } = useOpenContracts(workspace)
  const [picked, setPicked] = useState<string | null>(null)
  const all = contracts.flatMap((c) => c.clients)
  const choose = all.length > 1
  const client = picked !== null && all.includes(picked) ? picked : last
  return (
    <div className={[styles.root, choose && styles.idle].filter(Boolean).join(' ')}>
      {choose && (
        <Select
          compact
          label="Client"
          value={client ?? all[0]}
          options={all.map((c) => ({
            value: c,
            label: c,
            ...(contracts.length > 1
              ? { group: contractName(contracts.find((x) => x.clients.includes(c))) }
              : {})
          }))}
          onChange={setPicked}
        />
      )}
      <div className={styles.chip}>
        <button
          type="button"
          className={styles.main}
          onClick={() => {
            openAfterStart = true
            void window.api.tracking
              .start(workspace, '', undefined, choose ? client : undefined)
              .then((result) => {
                if (!result.ok) openAfterStart = false
              })
          }}
        >
          <Play size={12} strokeWidth={1.75} fill="currentColor" aria-hidden />
          Start
        </button>
      </div>
    </div>
  )
}

/**
 * The timer in the top bar on every page. Running: the task, the block's clock and Stop; a click opens the popover.
 * Otherwise a Start that begins an unnamed timer at once; its popover then takes a name or an existing task.
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
