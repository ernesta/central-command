import { Bookmark, Check, Undo2 } from 'lucide-react'
import { IconButton } from '@renderer/components/IconButton'
import type { WatchItem } from '../shared/types'
import type { WatchItems } from './useWatchItems'
import styles from './ItemActions.module.css'

/**
 * A row's two icon buttons: Mark read (a read item's puts it back to New; a saved item is read already and has none) and Save.
 * Save sits last so it stays in the same place on every row.
 */
export function ItemActions({
  item,
  actions
}: {
  item: WatchItem
  actions: Pick<WatchItems, 'toggleSaved' | 'toggleRead'>
}): React.JSX.Element {
  return (
    <span className={styles.actions}>
      {item.state !== 'saved' && (
        <IconButton
          label={item.state === 'new' ? 'Mark read' : 'Mark new'}
          onClick={() => actions.toggleRead(item)}
        >
          {item.state === 'new' ? (
            <Check size={16} strokeWidth={1.75} />
          ) : (
            <Undo2 size={16} strokeWidth={1.75} />
          )}
        </IconButton>
      )}
      <IconButton
        label={item.state === 'saved' ? 'Saved' : 'Save'}
        aria-pressed={item.state === 'saved'}
        className={item.state === 'saved' ? styles.saved : undefined}
        onClick={() => actions.toggleSaved(item)}
      >
        <Bookmark
          size={16}
          strokeWidth={1.75}
          fill={item.state === 'saved' ? 'currentColor' : 'none'}
        />
      </IconButton>
    </span>
  )
}
