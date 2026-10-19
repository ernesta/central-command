import { useEffect, useRef, useState } from 'react'
import { FieldError } from '@renderer/components/FieldError'
import { TimeInput } from '@renderer/components/TimeInput'
import { pushUndo } from '@renderer/components/undo-store'
import type { RunningTimer, TimerResult } from '@shared/tracking/api'
import { formatHours } from '@shared/tracking/format'
import styles from './StartedAt.module.css'

const REASONS: Record<string, string> = {
  'in-future': 'That is later than now.',
  'covers-entry': 'That would cover an earlier entry.',
  stale: 'This timer is from an earlier day.'
}

/**
 * Change when the running timer started. Cmd-Z puts the start back (an earlier entry the change trimmed stays trimmed), while that
 * session still runs.
 */
async function changeStart(running: RunningTimer, time: string): Promise<TimerResult> {
  const { workspace, year, session } = running
  const result = await window.api.tracking.setStart(workspace, year, session.id, time)
  if (result.ok) {
    const was = session.start
    pushUndo({
      label: 'change of the start time',
      undo: async () => {
        const back = await window.api.tracking.setStart(workspace, year, session.id, was)
        if (!back.ok) throw new Error(REASONS[back.reason] ?? 'The timer is not running any more.')
      }
    })
  }
  return result
}

/**
 * When the running timer started, as a time field like the others (hours and minutes, arrows step). A change is saved
 * on Enter or when the field loses focus, so typing the two parts never saves half a time; Escape puts it back.
 */
export function StartedAt({
  running,
  clock,
  actions
}: {
  running: RunningTimer
  clock: number
  /** Buttons at the right end of the line (Stop, Discard). */
  actions?: React.ReactNode
}): React.JSX.Element {
  const { session } = running
  const saved = session.start.slice(0, 5)
  const [draft, setDraft] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const value = draft ?? saved

  // A click outside closes the popover before the field loses focus, so a pending change is saved as it goes.
  const pending = useRef<() => void>(() => {})
  useEffect(() => {
    pending.current = () => {
      if (draft !== null && draft !== saved) void changeStart(running, `${draft}:00`)
    }
  })
  useEffect(() => () => pending.current(), [])

  const save = (): void => {
    if (draft === null || draft === saved) {
      setDraft(null)
      return
    }
    void changeStart(running, `${draft}:00`).then((result) => {
      if (result.ok) {
        setDraft(null)
        setRefused(null)
      } else setRefused(REASONS[result.reason] ?? 'Couldn’t change the start.')
    })
  }

  return (
    <div
      className={styles.wrap}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) save()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') save()
        else if (event.key === 'Escape' && draft !== null) {
          event.stopPropagation()
          setDraft(null)
          setRefused(null)
        }
      }}
    >
      <div className={styles.line}>
        <span>Started</span>
        <TimeInput
          aria-label="Started at"
          value={value}
          onChange={(time) => {
            if (time) setDraft(time)
          }}
        />
        <span>· {formatHours(clock)}</span>
        {actions && <span className={styles.actions}>{actions}</span>}
      </div>
      {refused && <FieldError message={refused} />}
    </div>
  )
}
