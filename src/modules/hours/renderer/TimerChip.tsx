import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Play, Square, Trash2 } from 'lucide-react'
import { Select } from '@renderer/components/Select'
import { researchOrWork } from '@renderer/shell/quick-actions'
import { TopBarPortal } from '@renderer/shell/top-bar-slot'
import { useQuickActionWorkspace } from '@renderer/shell/useQuickActionWorkspace'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { useSettings } from '@renderer/state/settings-context'
import { useNow } from '@renderer/state/use-now'
import { useRunningTimer } from '@renderer/state/use-running-timer'
import { useYearFile } from '@renderer/state/use-year-file'
import { WORKSPACES } from '@shared/settings'
import type { RunningTimer } from '@shared/tracking/api'
import { formatDay, formatHours } from '@shared/tracking/format'
import type { Moment } from '@shared/tracking/types'
import { useOpenTasks } from '../../tasks/renderer/useOpenTasks'
import { taskKey } from '../../tasks/shared/tracked'
import { recentTasks } from '../shared/start-picker'
import { elapsedMinutes } from '../shared/timer'
import type { HoursWorkspace } from '../shared/workspaces'
import { clearPickerRequest, startUnnamed, stopTimer, usePickerRequest } from './start-request'
import { StartedAt } from './StartedAt'
import { StaleTimer } from './StaleTimer'
import { TaskPicker, type PickedTask } from './TaskPicker'
import styles from './TimerChip.module.css'

/**
 * What the popover offers. A timer with no task yet asks for one (the one picker); with a task it shows it, when it began,
 * and the picker again to switch to another, and Stop. A timer from an earlier day only asks for its end.
 */
function TimerPopover({
  running,
  now,
  clock,
  query,
  hintClient,
  stopAfter,
  onClose
}: {
  running: RunningTimer
  now: Moment
  clock: number | null
  /** Typed into the picker at first. */
  query: string
  hintClient?: string
  /** The picker was opened by Stop: the timer stops once it has its task. */
  stopAfter: boolean
  onClose: () => void
}): React.JSX.Element {
  const { session } = running
  const data = useYearFile(running.workspace, running.year)
  const open = useOpenTasks(running.workspace)
  const clients = data?.plan.clients ?? []
  const tracking = window.api.tracking
  const [name, setName] = useState(query)
  const recent = useMemo(
    () =>
      data ? recentTasks(data, open, now.date).filter((t) => taskKey(t.uid) !== session.task) : [],
    [data, open, now.date, session.task]
  )
  const taskless = !session.task

  const give = async (picked: PickedTask): Promise<void> => {
    await tracking.assignTask(
      running.workspace,
      running.year,
      session.id,
      picked.label,
      picked.task,
      picked.client
    )
    if (stopAfter) await tracking.stop()
    onClose()
  }
  const switchTo = async (picked: PickedTask): Promise<void> => {
    await tracking.start(running.workspace, picked.label, picked.task, picked.client)
    onClose()
  }

  /** A timer started by mistake: drop it, saving nothing. */
  const discard = async (): Promise<void> => {
    await tracking.deleteSession(running.workspace, running.year, session.id)
    onClose()
  }

  return (
    <div className={styles.popover} role="dialog" aria-label="Timer">
      {taskless && clock !== null ? (
        <>
          <span className={styles.label}>
            {stopAfter ? 'Which task was this?' : session.label || 'No task yet'}
          </span>
          <TaskPicker
            workspace={running.workspace as HoursWorkspace}
            label="What are you working on?"
            placeholder="What are you working on?"
            value={name}
            onChange={setName}
            onPick={give}
            recent={recent}
            hintClient={hintClient}
            autoFocus
          />
        </>
      ) : (
        <div className={styles.full}>{session.label || 'No task yet'}</div>
      )}
      {clients.length > 0 && !taskless && (
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
          <StartedAt running={running} clock={clock} />
          {!taskless && (
            <TaskPicker
              workspace={running.workspace as HoursWorkspace}
              label="Switch to"
              placeholder="Switch to another task"
              value={name}
              onChange={setName}
              onPick={switchTo}
              recent={recent}
            />
          )}
          {!taskless && (
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
          )}
        </>
      )}
      {clock !== null && (
        <button type="button" className={styles.discard} onClick={() => void discard()}>
          <Trash2 size={12} strokeWidth={1.75} aria-hidden />
          Discard
        </button>
      )}
    </div>
  )
}

/**
 * Open/closed for a chip's popover: a click outside or Escape closes it, and Escape returns focus to the chip's button.
 * `forced` keeps it open (the picker was asked for); closing clears that too.
 */
function usePopover(forced: boolean): {
  open: boolean
  show: () => void
  close: () => void
  rootRef: React.RefObject<HTMLDivElement | null>
  mainRef: React.RefObject<HTMLButtonElement | null>
  onKeyDown: (event: React.KeyboardEvent) => void
} {
  const [asked, setAsked] = useState(false)
  const open = asked || forced
  const rootRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLButtonElement>(null)
  const close = (): void => {
    setAsked(false)
    clearPickerRequest()
  }

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent): void => {
      if (rootRef.current?.contains(event.target as Node)) return
      setAsked(false)
      clearPickerRequest()
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      close()
      mainRef.current?.focus()
    }
  }
  return { open, show: () => setAsked(true), close, rootRef, mainRef, onKeyDown }
}

function Chip({ running, now }: { running: RunningTimer; now: Moment }): React.JSX.Element {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const request = usePickerRequest()
  const { open, show, close, rootRef, mainRef, onKeyDown } = usePopover(request !== null)
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
          onClick={() => (open ? close() : show())}
        >
          <span className={styles.dot} aria-hidden />
          {running.workspace !== current && (
            <span className={styles.workspace}>{WORKSPACE_LABELS[running.workspace]}</span>
          )}
          <span className={styles.name}>{session.label || 'No task yet'}</span>
          <span className={styles.clock}>
            {clock === null ? formatDay(session.date) : formatHours(clock)}
          </span>
        </button>
        {clock !== null && (
          <button type="button" className={styles.stop} onClick={() => void stopTimer()}>
            Stop
          </button>
        )}
      </div>
      {open && (
        <TimerPopover
          key={request?.nonce ?? 0}
          running={running}
          now={now}
          clock={clock}
          query={request?.query ?? ''}
          hintClient={request?.client}
          stopAfter={request?.stopAfter ?? false}
          onClose={close}
        />
      )}
    </div>
  )
}

/**
 * No timer runs: a quiet Start in the running chip's place. It starts at once with no task; the chip then opens its
 * picker. In Work the client comes from the task chosen, so nothing is asked here.
 */
function IdleChip(): React.JSX.Element {
  const workspace = useQuickActionWorkspace()
  return (
    <div className={styles.root}>
      <div className={styles.chip}>
        <button
          type="button"
          className={styles.main}
          onClick={() => void startUnnamed(researchOrWork(workspace))}
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
