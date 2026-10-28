import { TriangleAlert } from 'lucide-react'
import { formatClock } from '@shared/locale-names'
import type { DerivedKind } from '@shared/tracking/types'
import type { HoursWorkspace } from '../../hours/shared/workspaces'
import type { MeetingMeta } from '../shared/types'
import { useMeetingClashes } from './useMeetingClashes'
import styles from './MeetingHoursNote.module.css'

/**
 * One line under the details, only when the meeting overlaps something else on the clock (it warns and changes nothing).
 */
export function MeetingHoursNote({
  workspace,
  id,
  meta,
  kind = 'meeting',
  renamedFrom
}: {
  workspace: HoursWorkspace
  id: string
  /** What it needs of a note: a meeting's, or a training's (`task` is its uid, '' for none). */
  meta: Pick<MeetingMeta, 'task' | 'date' | 'start' | 'end'>
  kind?: DerivedKind
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
  return null
}
