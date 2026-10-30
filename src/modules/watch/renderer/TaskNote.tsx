import type { WatchTaskLink } from '@modules/tasks/shared/watch-links'
import { CutText } from '@renderer/components/CutText'
import { watchTaskView } from '../shared/watch-tasks'
import styles from './TaskNote.module.css'

/** "Task: <title>", a small muted link to the task made from the row's item (open or done); nothing when there is none. */
export function TaskNote({
  link,
  open
}: {
  link: WatchTaskLink | undefined
  open: (uid: string) => void
}): React.JSX.Element | null {
  const { note } = watchTaskView(link)
  if (!note) return null
  return (
    <button
      type="button"
      className={styles.note}
      // The row behind it opens the item's page; this goes to the task instead.
      onClick={(event) => {
        event.stopPropagation()
        open(note.uid)
      }}
    >
      <CutText>{`Task: ${note.title}`}</CutText>
    </button>
  )
}
