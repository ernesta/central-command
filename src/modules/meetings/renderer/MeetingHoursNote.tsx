import { TriangleAlert } from 'lucide-react'
import { durationMinutes } from '../shared/time'
import type { DerivedKind } from '@shared/tracking/types'
import type { MeetingMeta, MeetingWorkspace } from '../shared/types'
import { useMeetingClashes } from './useMeetingClashes'
import styles from './MeetingHoursNote.module.css'

/**
 * One quiet line under the details, only when there is something to say: the meeting overlaps something else on the clock
 * (it warns and changes nothing), or it has a task but not both times yet (no hours until it does).
 */
export function MeetingHoursNote({
  workspace,
  id,
  meta,
  kind = 'meeting'
}: {
  workspace: MeetingWorkspace
  id: string
  /** What it needs of a note: a meeting's, or a lecture's (`task` is its uid, '' for none). */
  meta: Pick<MeetingMeta, 'task' | 'date' | 'start' | 'end'>
  kind?: DerivedKind
}): React.JSX.Element | null {
  const clashes = useMeetingClashes(workspace, id, meta, kind)
  if (clashes.length > 0) {
    const names = clashes
      .map(
        (c) =>
          `${c.label || 'Untitled'} ${c.start.slice(0, 5)}–${c.end ? c.end.slice(0, 5) : 'now'}`
      )
      .join(', ')
    return (
      <p className={styles.warn} role="status">
        <TriangleAlert size={15} strokeWidth={1.75} aria-hidden />
        <span>Overlaps {names}.</span>
      </p>
    )
  }
  if (meta.task && meta.date && durationMinutes(meta.start, meta.end) === null) {
    return <p className={styles.quiet}>No hours until it has a start and end.</p>
  }
  if (meta.task && !meta.date) return <p className={styles.quiet}>No hours until it has a date.</p>
  return null
}
