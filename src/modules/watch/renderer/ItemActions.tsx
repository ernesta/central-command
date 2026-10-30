import { Bookmark, Check, ListChecks, ListPlus, Pencil, Trash2, Undo2 } from 'lucide-react'
import { IconButton } from '@renderer/components/IconButton'
import type { WatchItem } from '../shared/types'
import { watchTaskView } from '../shared/watch-tasks'
import type { EntryActions } from './useManualEntries'
import type { WatchItems } from './useWatchItems'
import styles from './ItemActions.module.css'

/**
 * A row's icon buttons: Mark as read (a read item's puts it back to New; a saved item is read already and has none), Task (or Open
 * task, while the item's task is open) and Save, and for an entry added by hand Edit and Delete before them. Save sits last so it stays
 * in the same place on every row.
 */
export function ItemActions({
  item,
  actions
}: {
  item: WatchItem
  actions: Pick<WatchItems, 'toggleSaved' | 'toggleRead' | 'tasks' | 'startTask' | 'openTask'> &
    Partial<EntryActions>
}): React.JSX.Element {
  const task = watchTaskView(actions.tasks.get(item.id))
  return (
    <span className={styles.actions}>
      {item.manual && actions.edit && (
        <IconButton label="Edit" onClick={() => actions.edit?.(item)}>
          <Pencil size={16} strokeWidth={1.75} />
        </IconButton>
      )}
      {item.manual && actions.remove && (
        <IconButton label="Delete" onClick={() => actions.remove?.(item)}>
          <Trash2 size={16} strokeWidth={1.75} />
        </IconButton>
      )}
      {item.state !== 'saved' && (
        <IconButton
          label={item.state === 'new' ? 'Mark as read' : 'Mark as unread'}
          onClick={() => actions.toggleRead(item)}
        >
          {item.state === 'new' ? (
            <Check size={16} strokeWidth={1.75} />
          ) : (
            <Undo2 size={16} strokeWidth={1.75} />
          )}
        </IconButton>
      )}
      {task.button === 'open' && task.note ? (
        <IconButton label="Open task" onClick={() => actions.openTask(task.note?.uid ?? '')}>
          <ListChecks size={16} strokeWidth={1.75} />
        </IconButton>
      ) : (
        <IconButton label="Task" onClick={() => actions.startTask(item)}>
          <ListPlus size={16} strokeWidth={1.75} />
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
