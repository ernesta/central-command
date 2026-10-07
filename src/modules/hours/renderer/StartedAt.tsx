import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { FieldError } from '@renderer/components/FieldError'
import { Input } from '@renderer/components/Input'
import type { RunningTimer } from '@shared/tracking/api'
import { clockTime, formatHours } from '@shared/tracking/format'
import { lastEndBefore, overlapsFor, resolveStart } from '@shared/tracking/timer'
import type { Moment, TrackingYear } from '@shared/tracking/types'
import styles from './StartedAt.module.css'

const REASONS: Record<string, string> = {
  'bad-time': 'Type a time like 10:15, or minutes ago like -20.',
  'in-future': 'That is later than now.',
  'before-midnight': 'That is before midnight. Add the time instead.',
  'covers-entry': 'That would cover an earlier entry.',
  stale: 'This timer is from an earlier day.'
}

/**
 * When the running timer started, and how to change it: a time (`10:15`), minutes ago (`-20`) or "Since last entry
 * ended". An earlier entry the new start overlaps is trimmed, and the line under the field says which before you press Enter.
 */
export function StartedAt({
  running,
  data,
  now,
  clock
}: {
  running: RunningTimer
  data: TrackingYear | null
  now: Moment
  clock: number
}): React.JSX.Element {
  const { session } = running
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [refused, setRefused] = useState<string | null>(null)

  const parsed = text.trim() === '' ? null : resolveStart(text, now)
  const last = data ? lastEndBefore(data, session) : null
  const overlaps = parsed?.ok && data ? overlapsFor(data, session, parsed.time) : null
  const error = refused ?? (parsed && !parsed.ok ? REASONS[parsed.reason] : null)
  const trimmedNote =
    overlaps && overlaps.swallowed.length === 0 && overlaps.trimmed.length > 0 && parsed?.ok
      ? `Shortens ${overlaps.trimmed.map((s) => s.label || 'an unnamed entry').join(', ')} to end at ${clockTime(parsed.time)}.`
      : null

  const close = (): void => {
    setEditing(false)
    setText('')
    setRefused(null)
  }
  const apply = (time: string): void => {
    void window.api.tracking
      .setStart(running.workspace, running.year, session.id, time)
      .then((result) => {
        if (result.ok) close()
        else setRefused(REASONS[result.reason] ?? 'Could not change the start.')
      })
  }
  const submit = (): void => {
    if (parsed?.ok) apply(parsed.time)
  }

  if (!editing) {
    return (
      <div className={styles.line}>
        <span>
          Started {clockTime(session.start)} · {formatHours(clock)} so far
        </span>
        <button type="button" className={styles.change} onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    )
  }
  return (
    <div
      className={styles.edit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          close()
        }
      }}
    >
      <div className={styles.row}>
        <Input
          autoFocus
          aria-label="Started at"
          placeholder="10:15 or -20"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setRefused(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
        <Button variant="primary" disabled={!parsed?.ok} onClick={submit}>
          Set
        </Button>
      </div>
      {last !== null && last < session.start && (
        <button type="button" className={styles.change} onClick={() => apply(last)}>
          Since last entry ended ({clockTime(last)})
        </button>
      )}
      {trimmedNote && <div className={styles.muted}>{trimmedNote}</div>}
      {error && <FieldError message={error} />}
    </div>
  )
}
