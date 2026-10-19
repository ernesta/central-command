import { TriangleAlert } from 'lucide-react'
import { formatClock } from '@shared/locale-names'
import { durationMinutes } from '../shared/time'
import type { DerivedKind } from '@shared/tracking/types'
import type { HoursWorkspace } from '../../hours/shared/workspaces'
import type { MeetingMeta } from '../shared/types'
import { useMeetingClashes } from './useMeetingClashes'
import styles from './MeetingHoursNote.module.css'

/** "No hours until …", only for a note that has a task but not yet what its hours need. */
export function HoursLine({
  meta
}: {
  meta: Pick<MeetingMeta, 'task' | 'date' | 'start' | 'end'>
}): React.JSX.Element | null {
  if (meta.task && meta.date && durationMinutes(meta.start, meta.end) === null) {
    return <p className={styles.quiet}>No hours until it has a start and end.</p>
  }
  if (meta.task && !meta.date) return <p className={styles.quiet}>No hours until it has a date.</p>
  return null
}

/**
 * One quiet line under the details, only when there is something to say: the meeting overlaps something else on the clock
 * (it warns and changes nothing), or it has a task but not both times yet (no hours until it does).
 */
export function MeetingHoursNote({
  workspace,
  id,
  meta,
  kind = 'meeting',
  show = 'both',
  renamedFrom
}: {
  workspace: HoursWorkspace
  id: string
  /** What it needs of a note: a meeting's, or a lecture's (`task` is its uid, '' for none). */
  meta: Pick<MeetingMeta, 'task' | 'date' | 'start' | 'end'>
  kind?: DerivedKind
  /** `clashes`: only the overlap (a training entry draws it apart from its task card, where `HoursLine` goes). */
  show?: 'both' | 'clashes'
  /** The names the note has had (a training entry is renamed by its date and title). */
  renamedFrom?: readonly string[]
}): React.JSX.Element | null {
  const clashes = useMeetingClashes(workspace, id, meta, kind, renamedFrom)
  if (clashes.length > 0) {
    const names = clashes
      .map(
        (c) =>
          `${c.label || 'Untitled'} ${formatClock(c.start)}–${c.end ? formatClock(c.end) : 'now'}`
      )
      .join(', ')
    return (
      <p className={styles.warn} role="status">
        <TriangleAlert size={15} strokeWidth={1.75} aria-hidden />
        <span>Overlaps {names}.</span>
      </p>
    )
  }
  return show === 'both' ? <HoursLine meta={meta} /> : null
}
